// Explicit skill migration: validate first, preserve a recovery journal, and
// publish state + JSON + readable catalog through one metadata transaction.
// Directory moves are same-volume only. This is a recoverable application
// protocol, not an OS-wide atomic transaction; foreign edits stop rollback.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {build,planBuild} from './build-skills-index.mjs'
import {captureMetadataPreimages} from './metadata-transaction.mjs'
const CORE = [
  'skill-router',
  'assertion-discipline',
  'backup-retention',
  'clean-temp',
  'database-discipline',
  'disk-junction-migration',
  'doc-authoring',
  'dsh-instance-handoff',
  'frontend-motion-delivery',
  'i-have-adhd',
  'install-location',
  'long-task-discipline',
  'rule-engineering',
  'runtime-truth-verifier',
  'safe-text',
  'ship-clean-pr',
  'ship-clean-svn',
  'skill-trim-with-capability-transfer',
  'verify-before-claim',
  'verify-ui-in-browser',
  'vibe-coding',
]

const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
function fail(code){throw Error(code)}
function exists(file){try{return fs.lstatSync(file)}catch(e){if(e.code==='ENOENT')return null;throw e}}
function tree(root){
 const out=[]
 function walk(dir,relative=''){
  const stat=fs.lstatSync(dir)
  if(!stat.isDirectory()||stat.isSymbolicLink())fail('MIGRATION_LINK_OR_TYPE')
  out.push([relative,'dir',stat.dev,stat.ino])
  for(const name of fs.readdirSync(dir).sort()){
   const file=path.join(dir,name),rel=relative?relative+'/'+name:name,info=fs.lstatSync(file)
   if(info.isSymbolicLink())fail('MIGRATION_LINK_OR_TYPE')
   if(info.isDirectory())walk(file,rel)
   else if(info.isFile()&&info.nlink===1)out.push([rel,'file',info.dev,info.ino,digest(fs.readFileSync(file))])
   else fail('MIGRATION_LINK_OR_TYPE')
  }
 }
 walk(root);return JSON.stringify(out)
}
function options(argv){
 const out={apply:false,check:false,restoreAll:false,keep:[],restore:[]},seen=new Set()
 for(let i=0;i<argv.length;i++){
  const arg=argv[i]
  if(seen.has(arg))fail('USAGE: duplicate '+arg);seen.add(arg)
  if(arg==='--apply')out.apply=true
  else if(arg==='--check')out.check=true
  else if(arg==='--restore-all')out.restoreAll=true
  else if(arg==='--keep'||arg==='--restore'){
   const value=argv[++i];if(!value||value.startsWith('--'))fail('USAGE: missing value '+arg)
   const names=value.split(',').map(x=>x.trim()).filter(Boolean)
   if(!names.length||names.some(x=>! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)))fail('USAGE: invalid skill name')
   out[arg==='--keep'?'keep':'restore']=names
  }else fail('USAGE: unknown option '+arg)
 }
 if(out.check&&(out.apply||out.restoreAll||out.restore.length||out.keep.length))fail('USAGE: --check cannot mutate')
 if(out.restoreAll&&out.restore.length)fail('USAGE: conflicting restore selectors')
 return out
}
function dirs(root){
 if(!exists(root))return []
 return fs.readdirSync(root,{withFileTypes:true}).filter(e=>(e.isDirectory()||e.isSymbolicLink())&&exists(path.join(root,e.name,'SKILL.md'))).map(e=>e.name).sort()
}
export function runTier(argv=process.argv.slice(2),env=process.env){
 const opt=options(argv),home=path.resolve(env.DSH_HOME||path.join(os.homedir(),'.dsh'))
 if(opt.check){const doc=build({home,check:true,quiet:true});if(doc.drift.length)fail('DRIFT: '+doc.drift.join('; '));console.log('OK: current scanned roots match snapshot');return}
 const core=path.join(home,'skills'),library=path.join(home,'skills-library'),restoring=opt.restoreAll||opt.restore.length>0
 const keep=new Set([...CORE,...opt.keep]),names=restoring?(opt.restoreAll?dirs(library):opt.restore):dirs(core).filter(x=>!keep.has(x))
 const moves=names.map(name=>({name,from:path.join(restoring?library:core,name),to:path.join(restoring?core:library,name)})).filter(item=>{
  if(!exists(item.from)){console.log('SKIP '+item.name+': missing');return false}
  if(exists(item.to)){console.log('SKIP '+item.name+': exists');return false}
  return true
 })
 if(!opt.apply){for(const item of moves)console.log((restoring?'would-restore ':'would-move ')+item.name);console.log('dry-run='+moves.length);return}
 const preimages=captureMetadataPreimages(home,['skills-index.json','INDEX.md','skills-tier-state.json'])
 const stateFile=path.join(home,'skills-tier-state.json'),oldState=exists(stateFile)
 if(oldState&&(!oldState.isFile()||oldState.isSymbolicLink()||oldState.nlink!==1))fail('TIER_STATE_TYPE')
 const previous=oldState?JSON.parse(fs.readFileSync(stateFile,'utf8')):{moves:[]}
 if(!Array.isArray(previous.moves))fail('TIER_STATE_SCHEMA')
 const now=new Date().toISOString(),history=previous.moves.filter(x=>!moves.some(item=>item.name===x.name))
 if(!restoring)for(const item of moves)history.push({name:item.name,moved_at:now})
 const state=Buffer.from(JSON.stringify({updated_at:now,moves:history},null,1)+'\n')
 const additionalOutputs=[{name:'skills-tier-state.json',bytes:state}]
 // Full frontmatter and output validation happens before the first directory move.
 const baseline=planBuild({home,additionalOutputs})
 if(JSON.stringify(baseline.preimages)!==JSON.stringify(preimages))fail('METADATA_CONFLICT: preimage changed during planning')
 for(const item of moves)item.identity=tree(item.from)
 const stage=fs.mkdtempSync(path.join(home,'.dsh-tier-')),journal=path.join(stage,'recovery.json'),done=[]
 const record={schema:1,home,phase:'prepared',moves:moves.map(({name,from,to,identity})=>({name,from,to,identity}))}
 fs.writeFileSync(journal,JSON.stringify(record,null,2),{flag:'wx'})
 const targetRoot=restoring?core:library,createdTarget=!exists(targetRoot)
 try{
  if(createdTarget)fs.mkdirSync(targetRoot)
  for(const item of moves){
   if(exists(item.to)||tree(item.from)!==item.identity)fail('MIGRATION_SOURCE_OR_TARGET_CHANGED')
   try{fs.renameSync(item.from,item.to)}catch(error){if(error.code==='EXDEV')fail('CROSS_VOLUME_MIGRATION_REFUSED');throw error}
   done.push(item)
   if(tree(item.to)!==item.identity)fail('MIGRATION_MOVED_OBJECT_CHANGED')
  }
  record.phase='moved';fs.writeFileSync(journal,JSON.stringify(record,null,2))
  const doc=build({home,quiet:true,additionalOutputs,preimages})
  record.phase='committed';fs.writeFileSync(journal,JSON.stringify(record,null,2))
  fs.unlinkSync(journal);fs.rmdirSync(stage)
  console.log((restoring?'restored=':'moved=')+done.length+' index='+doc.count)
 }catch(error){
  if(error.committed||record.phase==='committed')throw Object.assign(Error('TIER_COMMITTED_CLEANUP_PENDING: '+stage,{cause:error}),{committed:true})
  let conflict=/RECOVERY_REQUIRED/.test(error.message)
  for(const item of done.toReversed()){
   try{if(exists(item.from)||tree(item.to)!==item.identity)fail('MIGRATION_ROLLBACK_FOREIGN');fs.renameSync(item.to,item.from);if(tree(item.from)!==item.identity)fail('MIGRATION_RESTORED_OBJECT_CHANGED')}
   catch{conflict=true}
  }
  if(createdTarget)try{fs.rmdirSync(targetRoot)}catch{ /* retain nonempty/foreign directory */ }
  record.phase=conflict?'recovery-required':'rolled-back';fs.writeFileSync(journal,JSON.stringify(record,null,2))
  throw Error((conflict?'TIER_RECOVERY_REQUIRED: ':'TIER_ROLLED_BACK: ')+stage+'; '+error.message,{cause:error})
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{runTier()}catch(error){console.error('ERROR: '+error.message);process.exitCode=error.message.startsWith('USAGE:')?2:1}
}
