// Optional explicit acceptance, never an automatically scanned node:test file.
// Third-party bytes are data only. All mutations stay in a fresh caller-owned
// work directory; the formal repair library supplies every transaction.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
const REPO=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'))
const PINS=Object.freeze({name:'billion-context',version:'0.1.212',before:'e512ccc1880ac2ed82657b779a5e4b518f88ff700baa8a04e399b908e5119599',after:'7a4185d855452c04bd15e7a63b490780f5f1ee8f550658b6953283037ecab611'})
const TRUSTED=Object.freeze([
 {name:'scripts/lib/bili-status-cors.mjs',sha256:'0bbd67ea971d3480b1329db81fa3806a9e8f1eb16f43dd2632bc4ae9ca6bb93b'},
 {name:'scripts/repair-bili-status-cors.mjs',sha256:'19ee0b50d986f315e187f321946a0cc6242f5c3ac9c301741c23b9e72bc91185'},
 {name:'packages/ultimate-model/scripts/metadata-transaction.mjs',sha256:'1cec233403ea8cdc84b2d0a7a038d8742bdbf110587b8e9a930cd262e778971a'},
])
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),fail=(code,exitCode=3)=>Object.assign(new Error(code),{code,exitCode}),identity=st=>({dev:String(st.dev),ino:String(st.ino)})
const contains=(parent,child)=>{const rel=path.relative(parent,child);return!rel||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)}
function parseArgs(args){
 const seen=new Set(),options={}
 for(let i=0;i<args.length;i++){
  const flag=args[i];if(!['--source-bundle','--work-dir'].includes(flag)||seen.has(flag))throw fail('USAGE_EXPLICIT_SOURCE_AND_FRESH_WORK_REQUIRED',2)
  seen.add(flag);const value=args[++i];if(typeof value!=='string'||!path.isAbsolute(value)||value.startsWith('--'))throw fail('USAGE_ABSOLUTE_PATHS_REQUIRED',2)
  options[flag==='--source-bundle'?'source':'work']=path.resolve(value)
 }
 if(!options.source||!options.work)throw fail('USAGE_EXPLICIT_SOURCE_AND_FRESH_WORK_REQUIRED',2)
 return options
}
function directory(file){const st=fs.lstatSync(file,{bigint:true});if(!st.isDirectory()||st.isSymbolicLink())throw fail('PATH_BOUNDARY');return{path:file,...identity(st)}}
function readStable(file,max){
 const named=fs.lstatSync(file,{bigint:true});if(!named.isFile()||named.isSymbolicLink()||named.size>BigInt(max))throw fail('FILE_BOUNDARY_OR_SIZE')
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
 try{
  const before=fs.fstatSync(fd,{bigint:true}),bytes=fs.readFileSync(fd),after=fs.fstatSync(fd,{bigint:true}),last=fs.lstatSync(file,{bigint:true})
  if(before.dev!==named.dev||before.ino!==named.ino||after.dev!==last.dev||after.ino!==last.ino||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs||BigInt(bytes.length)!==after.size)throw fail('READ_CONFLICT')
  return{...identity(after),sha256:digest(bytes),bytes:bytes.length,mtimeNs:String(after.mtimeNs),data:bytes}
 }finally{fs.closeSync(fd)}
}
const signature=({data,...rest})=>rest
function sourceSnapshot(requested){
 const root=fs.realpathSync(requested),tokens=[directory(root),directory(path.join(root,'dist'))]
 if(fs.realpathSync(tokens[1].path)!==tokens[1].path)throw fail('SOURCE_DIST_ESCAPE')
 const metadata=readStable(path.join(root,'package.json'),131072),code=readStable(path.join(root,'dist','index.js'),8388608)
 let parsed;try{parsed=JSON.parse(metadata.data.toString('utf8'))}catch{throw fail('UNSUPPORTED_SOURCE_METADATA')}
 if(parsed?.name!==PINS.name||parsed?.version!==PINS.version||![PINS.before,PINS.after].includes(code.sha256))throw fail('UNSUPPORTED_SOURCE_VERSION_OR_BYTES')
 return{root,tokens,metadata,code}
}
function originalFixtureBytes(source){
 if(source.code.sha256===PINS.before)return Buffer.from(source.code.data)
 // Reverse only the pinned three edits, only to make an owned fixture. The
 // resulting original and its forward transformation are independently hashed.
 let text=source.code.data.toString('utf8')
 const helper='function __dshOptimizationBiliStatusCorsHeaders(trustedOrigin){const h={"content-type":"application/json"};if(trustedOrigin!==void 0&&trustedOrigin.length>0)h["access-control-allow-origin"]=trustedOrigin;return h}'
 const edits=[
  [helper,''],
  ['res.writeHead(404,jsonHeaders());res.end(JSON.stringify({ok:false,error:fallbackLatest?','res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:fallbackLatest?'],
  ['res.writeHead(400,__dshOptimizationBiliStatusCorsHeaders(req.headers.origin));res.end(JSON.stringify({ok:false,error:"conversationId query parameter is required"}));','res.writeHead(400,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:"conversationId query parameter is required"}));'],
 ]
 for(const[from,to]of edits){const at=text.indexOf(from);if(at<0||text.indexOf(from,at+from.length)>=0)throw fail('PINNED_REVERSE_SHAPE');text=text.slice(0,at)+to+text.slice(at+from.length)}
 const bytes=Buffer.from(text);if(digest(bytes)!==PINS.before)throw fail('PINNED_REVERSE_HASH');return bytes
}
function ownSources(){return TRUSTED.map(item=>{
 let cursor=REPO;for(const part of item.name.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw fail('OWN_SOURCE_LINK')}
 const source=readStable(cursor,65536);if(source.sha256!==item.sha256)throw fail('OWN_SOURCE_HASH');return{...item,data:source.data}
})}
function freshWork(requested,source){
 try{fs.lstatSync(requested);throw fail('WORK_DIRECTORY_MUST_NOT_EXIST',2)}catch(error){if(error.code!=='ENOENT')throw error}
 const parent=fs.realpathSync(path.dirname(requested));directory(parent)
 const work=path.join(parent,path.basename(requested))
 if(contains(REPO,work)||contains(source.root,work)||contains(work,REPO)||contains(work,source.root))throw fail('WORK_DIRECTORY_MUST_BE_OUTSIDE_REPO_AND_SOURCE',2)
 fs.mkdirSync(work,{mode:0o700});return directory(work)
}
function writeNew(file,bytes){const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
async function verify(options,state){
 const source=sourceSnapshot(options.source),original=originalFixtureBytes(source),own=ownSources()
 state.source=source;state.work=freshWork(options.work,source)
 const work=state.work.path,fixtureCode=path.join(work,'fixture-code'),fixtureRoot=path.join(work,'fixtures');fs.mkdirSync(fixtureCode);fs.mkdirSync(fixtureRoot)
 const guardWork=()=>{if(JSON.stringify(directory(work))!==JSON.stringify(state.work))throw fail('OWNED_WORK_CHANGED',1)}
 for(const file of own){const dest=path.join(fixtureCode,file.name);fs.mkdirSync(path.dirname(dest),{recursive:true});writeNew(dest,file.data)}
 writeNew(path.join(work,'invocation.json'),JSON.stringify({sourceBundle:source.root,sourceSha256:source.code.sha256,inputState:source.code.sha256===PINS.before?'original':'repaired',fixtureOriginalSha256:digest(original),trustedOwnFiles:TRUSTED,thirdPartyImported:false,sourceWrites:0},null,2)+'\n')
 const api=await import(pathToFileURL(path.join(fixtureCode,'scripts/lib/bili-status-cors.mjs')).href)
 assert.deepEqual(api.PINS,PINS);assert.equal(digest(api.transformBiliStatusCors(original)),PINS.after)
 if(source.code.sha256===PINS.after)assert.equal(digest(api.transformBiliStatusCors(original)),source.code.sha256)
 const helperFile=path.join(fixtureCode,'packages/ultimate-model/scripts/metadata-transaction.mjs'),helper=own.find(file=>file.name.startsWith('packages/')).data,cliFile=path.join(fixtureCode,'scripts/repair-bili-status-cors.mjs')
 const{planBiliStatusCors,applyBiliStatusCors,planBiliStatusCorsRestore,applyBiliStatusCorsRestore}=api
 const stamp=file=>signature(readStable(file,8388608))
 const cases=state.cases
 function tree(name){
  guardWork();const home=path.join(fixtureRoot,name),bundle=path.join(home,'bundle'),dist=path.join(bundle,'dist'),backup=path.join(home,'backup'),alias=path.join(home,'pnpm-store-alias.js'),code=path.join(dist,'index.js')
  fs.mkdirSync(home);fs.mkdirSync(dist,{recursive:true});fs.mkdirSync(backup);writeNew(code,original);writeNew(path.join(bundle,'package.json'),source.metadata.data);fs.linkSync(code,alias)
  return{home,bundle,dist,backup,alias,code}
 }
 let childExits=[]
 const command=(file,args)=>{guardWork();const result=spawnSync(process.execPath,[file,...args],{encoding:'utf8',timeout:30000,maxBuffer:524288});childExits.push(result.status);if(result.error)throw result.error;return result}
 const cli=(fixture,args=[],expected=0)=>{const child=command(cliFile,['--bundle-root',fixture.bundle,...args]);assert.equal(child.status,expected,'formal CLI exit');let result;try{result=JSON.parse(child.stdout)}catch{throw fail('FIXTURE_CLI_JSON',1)}return result}
 async function check(id,fn){
  childExits=[]
  try{guardWork();const details=await fn();cases.push({id,pass:true,exitCode:0,childExitCodes:childExits,...details})}
  catch(error){cases.push({id,pass:false,exitCode:1,childExitCodes:childExits,error:{name:error.name,code:error.code??null,message:String(error.message).slice(0,500)}});throw error}
 }
 await check('actual-cli-dryrun-apply-keep-restore-dryrun-apply-keep',async()=>{
  const t=tree('cli-happy'),aliasBefore=stamp(t.alias),codeBefore=stamp(t.code),dry=cli(t)
  assert.equal(dry.action,'REPAIR');assert.equal(dry.dryRun,true);assert.deepEqual(stamp(t.code),codeBefore);assert.deepEqual(fs.readdirSync(t.backup),[]);assert.deepEqual(fs.readdirSync(t.dist),['index.js'])
  const applied=cli(t,['--apply','--backup-dir',t.backup]),next=stamp(t.code),nextInfo=fs.statSync(t.code,{bigint:true})
  assert.equal(applied.committed,true);assert.equal(applied.cleanupComplete,true);assert.equal(next.sha256,PINS.after);assert.equal(nextInfo.nlink,1n);assert.notEqual(next.ino,aliasBefore.ino)
  assert.equal(stamp(t.alias).sha256,aliasBefore.sha256);assert.equal(stamp(t.alias).mtimeNs,aliasBefore.mtimeNs);assert.equal(digest(fs.readFileSync(applied.backup)),PINS.before);assert.equal(JSON.parse(fs.readFileSync(applied.receipt)).state,'backup-before-withdraw')
  assert.equal(command('--check',[t.code]).status,0)
  const backups=fs.readdirSync(t.backup),kept=cli(t,['--apply','--backup-dir',t.backup]);assert.equal(kept.action,'KEEP');assert.equal(kept.applied,false);assert.deepEqual(stamp(t.code),next);assert.deepEqual(fs.readdirSync(t.backup),backups)
  const restoreDry=cli(t,['--backup-dir',t.backup,'--restore-receipt',applied.receipt]);assert.equal(restoreDry.action,'RESTORE');assert.deepEqual(stamp(t.code),next)
  const restored=cli(t,['--apply','--backup-dir',t.backup,'--restore-receipt',applied.receipt]);assert.equal(restored.committed,true);assert.equal(stamp(t.code).sha256,PINS.before);assert.equal(stamp(t.alias).sha256,PINS.before);assert.equal(stamp(t.alias).mtimeNs,aliasBefore.mtimeNs)
  assert.equal(command('--check',[t.code]).status,0)
  const restoredStamp=stamp(t.code),restoreKeep=cli(t,['--apply','--backup-dir',t.backup,'--restore-receipt',applied.receipt]);assert.equal(restoreKeep.action,'KEEP');assert.equal(restoreKeep.applied,false);assert.deepEqual(stamp(t.code),restoredStamp)
  return{newTargetNlink:1,hardlinkAliasBytesAndMtimeUnchanged:true,permanentBackupAndReceipt:true}
 })
 await check('stale-code-plan-preserves-concurrent-bytes',async()=>{
  const t=tree('stale-plan'),plan=planBiliStatusCors(t.bundle);fs.appendFileSync(t.code,'\n/* owned concurrent local change */');const changed=stamp(t.code)
  await assert.rejects(applyBiliStatusCors(plan,{backupDir:t.backup}),{code:'BILI_CORS_CONFLICT'});assert.deepEqual(stamp(t.code),changed);assert.deepEqual(fs.readdirSync(t.backup),[])
 })
 await check('unsupported-version-cli-exit3-no-write',async()=>{
  const t=tree('unknown-version');fs.writeFileSync(path.join(t.bundle,'package.json'),JSON.stringify({name:PINS.name,version:'0.1.213'}));const before=stamp(t.code)
  assert.equal(cli(t,['--apply','--backup-dir',t.backup],3).action,'REVIEW_UPDATE');assert.deepEqual(stamp(t.code),before);assert.deepEqual(fs.readdirSync(t.backup),[])
 })
 await check('absent-window-concurrent-target-never-covered',async()=>{
  const t=tree('concurrent-target');let caught
  try{await applyBiliStatusCors(planBiliStatusCors(t.bundle),{backupDir:t.backup,onPhase:event=>{if(event.phase==='after-withdraw')writeNew(t.code,'owned concurrent target')}})}catch(error){caught=error}
  assert.ok(caught);assert.equal(caught.biliCors.committed,false);assert.equal(caught.biliCors.restored,false);assert.equal(caught.biliCors.restoreError,'BILI_CORS_CONCURRENT_TARGET');assert.equal(fs.readFileSync(t.code,'utf8'),'owned concurrent target');assert.equal(stamp(t.alias).sha256,PINS.before);assert.equal(digest(fs.readFileSync(path.join(caught.biliCors.stage,'previous.js'))),PINS.before)
 })
 await check('hardlink-alias-change-after-withdraw-blocks-publication',async()=>{
  const t=tree('alias-race');let caught
  try{await applyBiliStatusCors(planBiliStatusCors(t.bundle),{backupDir:t.backup,onPhase:event=>{if(event.phase==='after-withdraw')fs.appendFileSync(t.alias,'\n/* owned alias modification */')}})}catch(error){caught=error}
  assert.equal(caught?.code,'BILI_CORS_WITHDRAWN_PREIMAGE_CHANGED');assert.equal(caught.biliCors.committed,false);assert.equal(caught.biliCors.restored,false);assert.equal(caught.biliCors.restoreError,'BILI_CORS_WITHDRAWN_PREIMAGE_CHANGED');assert.equal(caught.biliCors.recoveryRequired,true);assert.equal(fs.existsSync(t.code),false);assert.notEqual(stamp(t.alias).sha256,PINS.before);assert.equal(digest(fs.readFileSync(path.join(caught.biliCors.stage,'previous.js'))),stamp(t.alias).sha256)
 })
 await check('publication-failure-restores-original-exclusively',async()=>{
  const t=tree('publication-failure'),before=stamp(t.alias);let caught
  try{await applyBiliStatusCors(planBiliStatusCors(t.bundle),{backupDir:t.backup,onPhase:event=>{if(event.phase==='publish:prepared')throw Object.assign(new Error('OWNED_FIXTURE_FAILURE'),{code:'OWNED_FIXTURE_FAILURE'})}})}catch(error){caught=error}
  assert.equal(caught?.code,'OWNED_FIXTURE_FAILURE');assert.equal(caught.biliCors.committed,false);assert.equal(caught.biliCors.restored,true);assert.equal(stamp(t.code).sha256,PINS.before);assert.equal(stamp(t.alias).sha256,before.sha256);assert.equal(stamp(t.alias).mtimeNs,before.mtimeNs);assert.equal(fs.existsSync(caught.biliCors.backup),true)
 })
 await check('committed-publication-distinct-from-cleanup-warning',async()=>{
  const t=tree('cleanup-warning'),result=await applyBiliStatusCors(planBiliStatusCors(t.bundle),{backupDir:t.backup,onPhase:event=>{if(event.phase==='publish:before-final-verify')writeNew(path.join(event.stage,'unknown-owned-fixture.txt'),'preserve')}})
  assert.equal(result.committed,true);assert.equal(result.cleanupComplete,false);assert.equal(result.cleanupError,'BILI_CORS_UNKNOWN_STAGE_FILE');assert.equal(stamp(t.code).sha256,PINS.after);assert.equal(fs.readFileSync(path.join(result.stage,'unknown-owned-fixture.txt'),'utf8'),'preserve')
 })
 await check('unknown-backup-lock-retained-no-code-commit',async()=>{
  const t=tree('foreign-backup-lock'),lock=path.join(t.backup,'.skills-index.lock');writeNew(lock,'owned foreign lock');let caught
  try{await applyBiliStatusCors(planBiliStatusCors(t.bundle),{backupDir:t.backup})}catch(error){caught=error}
  assert.ok(caught);assert.equal(caught.biliCors.committed,false);assert.equal(stamp(t.code).sha256,PINS.before);assert.equal(fs.readFileSync(lock,'utf8'),'owned foreign lock')
 })
 await check('transaction-helper-pin-before-bundle-write',async()=>{
  const t=tree('helper-pin'),plan=planBiliStatusCors(t.bundle);fs.appendFileSync(helperFile,'\n/* owned tampered helper */')
  try{await assert.rejects(applyBiliStatusCors(plan,{backupDir:t.backup}),{code:'BILI_CORS_HELPER_HASH'});assert.deepEqual(fs.readdirSync(t.dist),['index.js']);assert.deepEqual(fs.readdirSync(t.backup),[]);assert.equal(stamp(t.code).sha256,PINS.before)}finally{fs.writeFileSync(helperFile,helper)}
 })
 await check('restore-unknown-current-preserves-user-change',async()=>{
  const t=tree('restore-unknown-current'),applied=cli(t,['--apply','--backup-dir',t.backup]);fs.appendFileSync(t.code,'\n/* owned user change after repair */');const before=stamp(t.code),backups=fs.readdirSync(t.backup)
  assert.equal(cli(t,['--apply','--backup-dir',t.backup,'--restore-receipt',applied.receipt],3).action,'REVIEW_UPDATE');assert.deepEqual(stamp(t.code),before);assert.deepEqual(fs.readdirSync(t.backup),backups)
 })
 await check('restore-bad-original-backup-refuses-before-write',async()=>{
  const t=tree('restore-bad-backup'),applied=cli(t,['--apply','--backup-dir',t.backup]);fs.appendFileSync(applied.backup,'\n/* owned changed backup */');const before=stamp(t.code),backups=fs.readdirSync(t.backup)
  assert.equal(cli(t,['--apply','--backup-dir',t.backup,'--restore-receipt',applied.receipt],1).error,'BILI_CORS_RESTORE_BACKUP');assert.deepEqual(stamp(t.code),before);assert.deepEqual(fs.readdirSync(t.backup),backups)
 })
 await check('restore-receipt-link-escape-rejected',async()=>{
  const t=tree('restore-receipt-link'),applied=cli(t,['--apply','--backup-dir',t.backup]),outside=path.join(t.home,'outside-receipt.json'),link=path.join(t.backup,'linked.json');writeNew(outside,fs.readFileSync(applied.receipt));fs.symlinkSync(outside,link,'file');const before=stamp(t.code)
  assert.throws(()=>planBiliStatusCorsRestore(t.bundle,{receiptFile:link,backupDir:t.backup}),{code:'BILI_CORS_PATH_BOUNDARY'});assert.deepEqual(stamp(t.code),before)
 })
 await check('restore-plan-cas-refuses-concurrent-target',async()=>{
  const t=tree('restore-cas'),applied=cli(t,['--apply','--backup-dir',t.backup]),plan=planBiliStatusCorsRestore(t.bundle,{receiptFile:applied.receipt,backupDir:t.backup});fs.appendFileSync(t.code,'\n/* owned concurrent restore target */');const before=stamp(t.code)
  await assert.rejects(applyBiliStatusCorsRestore(plan),{code:'BILI_CORS_RESTORE_CONFLICT'});assert.deepEqual(stamp(t.code),before)
 })
 for(const concurrent of [false,true])await check(concurrent?'changed-held-with-concurrent-target':'changed-held-with-absent-target',async()=>{
  const t=tree(concurrent?'changed-held-concurrent':'changed-held-absent');let caught
  try{await applyBiliStatusCors(planBiliStatusCors(t.bundle),{backupDir:t.backup,onPhase:event=>{if(event.phase==='after-withdraw'){fs.appendFileSync(t.alias,'\n/* exact owned concurrent alias change */');if(concurrent)writeNew(t.code,'exact owned concurrent target')}}})}catch(error){caught=error}
  assert.equal(caught?.code,'BILI_CORS_WITHDRAWN_PREIMAGE_CHANGED');assert.equal(caught.biliCors.committed,false);assert.equal(caught.biliCors.restored,false);assert.equal(caught.biliCors.restoreError,'BILI_CORS_WITHDRAWN_PREIMAGE_CHANGED');assert.equal(caught.biliCors.recoveryRequired,true)
  assert.notEqual(stamp(t.alias).sha256,PINS.before);assert.equal(digest(fs.readFileSync(path.join(caught.biliCors.stage,'previous.js'))),stamp(t.alias).sha256);assert.equal(fs.existsSync(t.code),concurrent)
  if(concurrent)assert.equal(fs.readFileSync(t.code,'utf8'),'exact owned concurrent target')
  assert.equal(fs.existsSync(caught.biliCors.backup),true);assert.equal(fs.existsSync(caught.biliCors.receipt),true);assert.equal(digest(fs.readFileSync(caught.biliCors.backup)),PINS.before)
 })
 assert.equal(cases.length,15)
 return{fixtureOriginalSha256:digest(original),inputState:source.code.sha256===PINS.before?'original':'repaired',ownSources:TRUSTED}
}
const state={cases:[]};let result,exitCode=0,details={}
try{
 const options=parseArgs(process.argv.slice(2));details=await verify(options,state)
 result={status:'PASS',reason:'ALL_OWNED_FIXTURES_VERIFIED'}
}catch(error){exitCode=error.exitCode??(['EPERM','EACCES','ENOSYS','ENOTSUP','ENOENT'].includes(error.code)?2:1);result={status:exitCode===2||exitCode===3?'PREREQ':'FAIL',reason:error.code??'VERIFIER_ASSERTION',error:{name:error.name,message:String(error.message).slice(0,500)}}}
let sourceUnchanged=null
if(state.source){try{const after=sourceSnapshot(state.source.root);sourceUnchanged=JSON.stringify(after.tokens)===JSON.stringify(state.source.tokens)&&JSON.stringify(signature(after.metadata))===JSON.stringify(signature(state.source.metadata))&&JSON.stringify(signature(after.code))===JSON.stringify(signature(state.source.code))}catch{sourceUnchanged=false}
 if(!sourceUnchanged){result.status='FAIL';result.reason='SOURCE_CHANGED_DURING_ACCEPTANCE';exitCode=1}}
result={...result,...details,sourceSha256:state.source?.code.sha256??null,sourceBytes:state.source?.code.bytes??null,sourceUnchanged,workDir:state.work?.path??null,pass:state.cases.filter(row=>row.pass).length,fail:state.cases.filter(row=>!row.pass).length,expectedCases:15,notRun:15-state.cases.length,cases:state.cases,sourceWrites:0,repositoryWrites:0,modelCalls:0,networkCalls:0,thirdPartyCodeImported:false,fixturesRetained:true,exitCode}
if(state.work){try{writeNew(path.join(state.work.path,'result.json'),JSON.stringify(result,null,2)+'\n')}catch{result.status='FAIL';result.reason='RESULT_RECEIPT_NOT_WRITTEN';exitCode=1;result.exitCode=1}}
console.log(JSON.stringify(result,null,2));process.exitCode=exitCode
