// Optional data overlay, no hooks, presets, model calls or home inference.
// Authenticate the archive/entry externally. A pinned, builtin-only helper is
// checked as bytes and imported from those exact bytes, never an arbitrary path.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const HELPER='packages/ultimate-model/scripts/metadata-transaction.mjs'
const HELPER_SHA256='1cec233403ea8cdc84b2d0a7a038d8742bdbf110587b8e9a930cd262e778971a'
const OVERLAY='overlays/global-workflow.md',TAG='DSH-OPTIMIZATION:WORKFLOW'
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const fail=code=>Object.assign(new Error(code),{code})
const id=stat=>({dev:String(stat.dev),ino:String(stat.ino)})
const identical=(a,b)=>a===null?b===null:b!==null&&a.dev===b.dev&&a.ino===b.ino&&a.hash===b.hash&&a.bytes===b.bytes
const signature=s=>s===null?null:(({data,...rest})=>rest)(s)
function readBoundary(file,{missing=false}={}){
 let named
 try{named=fs.lstatSync(file,{bigint:true})}catch(error){if(missing&&error.code==='ENOENT')return null;throw error}
 if(!named.isFile()||named.isSymbolicLink()||named.nlink!==1n)throw fail('WORKFLOW_FILE_TYPE')
 if(named.size>1048576n)throw fail('WORKFLOW_FILE_TOO_LARGE')
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
 try{
  const opened=fs.fstatSync(fd,{bigint:true}),data=fs.readFileSync(fd),after=fs.fstatSync(fd,{bigint:true}),last=fs.lstatSync(file,{bigint:true})
  if(opened.dev!==named.dev||opened.ino!==named.ino||after.dev!==last.dev||after.ino!==last.ino||after.size!==opened.size||after.mtimeNs!==opened.mtimeNs||after.ctimeNs!==opened.ctimeNs||BigInt(data.length)!==after.size)throw fail('WORKFLOW_CONFLICT')
  return{...id(after),bytes:data.length,hash:digest(data),data}
 }finally{fs.closeSync(fd)}
}
function source(rel){
 let cursor=REPO
 for(const part of rel.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw fail('WORKFLOW_SOURCE_LINK')}
 return readBoundary(cursor)
}
function homeBoundary(home){
 if(typeof home!=='string'||!path.isAbsolute(home))throw fail('WORKFLOW_ABSOLUTE_HOME_REQUIRED')
 home=path.resolve(home)
 const root=path.parse(home).root,tokens=[]
 let cursor=root
 for(const part of [null,...path.relative(root,home).split(path.sep).filter(Boolean)]){
  if(part!==null)cursor=path.join(cursor,part)
  const info=fs.lstatSync(cursor,{bigint:true})
  if(!info.isDirectory()||info.isSymbolicLink())throw fail('WORKFLOW_HOME_LINK_OR_TYPE')
  tokens.push({path:cursor,...id(info)})
 }
 const info=fs.statSync(home)
 if((info.mode&0o222)===0)throw fail('WORKFLOW_HOME_READONLY')
 fs.accessSync(home,fs.constants.R_OK|fs.constants.W_OK)
 return{home,tokens}
}
function sameHome(plan){
 const now=homeBoundary(plan.home)
 if(JSON.stringify(now.tokens)!==JSON.stringify(plan.homeTokens))throw fail('WORKFLOW_HOME_CHANGED')
}
function decode(bytes){try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw fail('WORKFLOW_UTF8_REQUIRED')}}
function overlayBody(snapshot){const body=decode(snapshot.data).replace(/\r\n/g,'\n').replace(/\n$/,'');if(body.includes('\r')||body.includes(TAG)||!body.trim())throw fail('WORKFLOW_OVERLAY_INVALID');return body}
function block(body,eol){const bytes=Buffer.from(body.replaceAll('\n',eol)+eol);return Buffer.from('<!-- '+TAG+':BEGIN v1 sha256='+digest(bytes)+' -->'+eol+bytes.toString('utf8')+'<!-- '+TAG+':END -->'+eol)}
export function planWorkflow(home){
 const boundary=homeBoundary(home),file=path.join(boundary.home,'AGENTS.md'),before=readBoundary(file,{missing:true}),template=source(OVERLAY),body=overlayBody(template),data=before?.data??Buffer.alloc(0)
 decode(data)
 if(before&&(fs.statSync(file).mode&0o222)===0)throw fail('WORKFLOW_AGENTS_READONLY')
 const lf=block(body,'\n'),crlf=block(body,'\r\n'),begin=Buffer.from('<!-- '+TAG+':BEGIN'),end=Buffer.from('<!-- '+TAG+':END -->'),first=data.indexOf(begin)
 let action='APPEND',reason='no managed block',next
 if(data.includes(Buffer.from(TAG))){
  const endAt=first<0?-1:data.indexOf(end,first),after=endAt<0?-1:endAt+end.length
  const matching=first>=0&&endAt>=0&&[lf,crlf].some(expected=>data.subarray(first,first+expected.length).equals(expected))
  const occurrences=data.toString('utf8').split(TAG).length-1
  if(matching&&occurrences===2&&data.indexOf(begin,first+1)<0&&data.indexOf(end,after)<0){action='KEEP';reason='exact managed block'}
  else{action='REVIEW_UPDATE';reason='managed block differs or is malformed; preserve local edits'}
 }else{
  const eol=data.includes(Buffer.from('\r\n'))?'\r\n':'\n',separator=data.length?(data.at(-1)===10?eol:eol+eol):''
  next=Buffer.concat([data,Buffer.from(separator),block(body,eol)])
 }
 return{home:boundary.home,homeTokens:boundary.tokens,action,reason,before:signature(before),original:data,next,overlay:signature(template)}
}
export const summarizeWorkflow=plan=>({home:plan.home,action:plan.action,reason:plan.reason,originalBytes:plan.original.length,originalHash:plan.before?.hash??null,nextBytes:plan.next?.length??plan.original.length,scope:'AGENTS.md managed workflow block only; active preset remains user-controlled'})
async function transactionAPI(){
 const bytes=source(HELPER).data
 if(digest(bytes)!==HELPER_SHA256)throw fail('WORKFLOW_HELPER_HASH')
 const api=await import('data:text/javascript;base64,'+bytes.toString('base64'))
 if(typeof api.publishMetadataPair!=='function'||typeof api.captureMetadataPreimages!=='function')throw fail('WORKFLOW_HELPER_API')
 return api
}
function recheck(plan){
 sameHome(plan)
 if(!identical(signature(source(OVERLAY)),plan.overlay))throw fail('WORKFLOW_SOURCE_CHANGED')
 const file=path.join(plan.home,'AGENTS.md'),now=readBoundary(file,{missing:true})
 if(!identical(signature(now),plan.before))throw fail('WORKFLOW_CONFLICT')
 if(now&&(fs.statSync(file).mode&0o222)===0)throw fail('WORKFLOW_AGENTS_READONLY')
 const canonical=planWorkflow(plan.home),sameBytes=(a,b)=>a===undefined?b===undefined:Buffer.isBuffer(a)&&Buffer.isBuffer(b)&&a.equals(b)
 if(plan.action!==canonical.action||!sameBytes(plan.original,canonical.original)||!sameBytes(plan.next,canonical.next))throw fail('WORKFLOW_PLAN_CHANGED')
}
export async function applyWorkflow(plan,{onPhase=()=>{}}={}){
 if(typeof onPhase!=='function')throw fail('WORKFLOW_INPUT')
 recheck(plan)
 if(plan.action==='KEEP')return{...summarizeWorkflow(plan),applied:false,kept:true}
 if(plan.action!=='APPEND')return{...summarizeWorkflow(plan),applied:false,reviewRequired:true}
 const api=await transactionAPI();recheck(plan)
 const backup='AGENTS.md.dsh-workflow-backup.'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+crypto.randomUUID()+'.bak'
 const hook=operation=>event=>{sameHome(plan);onPhase({...event,operation})}
 // Permanent backup has a separate committed transaction. A later conflict
 // must not erase it, nor may a backup be mistaken for a completed install.
 api.publishMetadataPair(plan.home,[{name:backup,bytes:plan.original}],{preimages:[{name:backup,before:null}],onPhase:hook('backup')})
 try{
  recheck(plan)
  const transaction=api.publishMetadataPair(plan.home,[{name:'AGENTS.md',bytes:plan.next}],{preimages:[{name:'AGENTS.md',before:plan.before}],onPhase:hook('agents')})
  return{...summarizeWorkflow(plan),applied:true,backup:path.join(plan.home,backup),originalExisted:plan.before!==null,installedHash:digest(plan.next),transaction}
 }catch(error){error.workflowBackup=path.join(plan.home,backup);throw error}
}
export function parseWorkflowArgs(args){
 const seen=new Set();let home,apply=false
 for(let i=0;i<args.length;i++){
  const arg=args[i]
  if(!['--home','--apply','--dry-run'].includes(arg)||seen.has(arg))throw fail('WORKFLOW_USAGE')
  seen.add(arg)
  if(arg==='--home'){home=args[++i];if(typeof home!=='string'||!home||home.startsWith('--')||!path.isAbsolute(home))throw fail('WORKFLOW_USAGE')}
  if(arg==='--apply')apply=true
 }
 if(!home||seen.has('--apply')&&seen.has('--dry-run'))throw fail('WORKFLOW_USAGE')
 return{home,apply}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const options=parseWorkflowArgs(process.argv.slice(2)),plan=planWorkflow(options.home),result=options.apply?await applyWorkflow(plan):{...summarizeWorkflow(plan),dryRun:true}
  console.log(JSON.stringify(result,null,2));if(plan.action==='REVIEW_UPDATE')process.exitCode=3
 }catch(error){console.log(JSON.stringify({ok:false,error:error.code||'WORKFLOW_IO',backup:error.workflowBackup,stage:error.stage,committed:error.committed},null,2));process.exitCode=error.code==='WORKFLOW_USAGE'?2:1}
}
