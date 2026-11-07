// A byte-pinned optional repair for two status error responses. Never import
// target package code, infer DSH_HOME, relax a management gate, or restart DSH.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
export const PINS=Object.freeze({name:'billion-context',version:'0.1.212',before:'e512ccc1880ac2ed82657b779a5e4b518f88ff700baa8a04e399b908e5119599',after:'7a4185d855452c04bd15e7a63b490780f5f1ee8f550658b6953283037ecab611'})
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const HELPER='packages/ultimate-model/scripts/metadata-transaction.mjs',HELPER_SHA='1cec233403ea8cdc84b2d0a7a038d8742bdbf110587b8e9a930cd262e778971a'
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const fail=code=>Object.assign(new Error(code),{code})
const headerName='__dshOptimizationBiliStatusCorsHeaders'
const jsonHelper='const jsonHeaders=()=>{const h={"content-type":"application/json"};if(trustedOrigin!==void 0&&trustedOrigin.length>0)h["access-control-allow-origin"]=trustedOrigin;return h}'
const bad404='res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:fallbackLatest?'
const bad400='res.writeHead(400,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:"conversationId query parameter is required"}));'
const one=(text,needle)=>{const at=text.indexOf(needle);if(at<0||text.indexOf(needle,at+needle.length)>=0)throw fail('BILI_CORS_PATCH_SHAPE');return at}
function functionRange(text,name){
 const start=one(text,'async function '+name+'('),after=start+('async function '+name+'(').length
 const next=/(?:async )?function [A-Za-z_$][\w$]*\(/.exec(text.slice(after))
 if(!next)throw fail('BILI_CORS_PATCH_SHAPE')
 return{start,end:after+next.index}
}
export function transformBiliStatusCors(bytes){
 if(!Buffer.isBuffer(bytes))throw fail('BILI_CORS_PATCH_SHAPE')
 let text
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw fail('BILI_CORS_PATCH_SHAPE')}
 if(!Buffer.from(text).equals(bytes)||text.includes(headerName))throw fail('BILI_CORS_PATCH_SHAPE')
 const status=functionRange(text,'handlePluginStatus'),body=text.slice(status.start,status.end)
 one(body,jsonHelper);const at404=one(body,bad404)
 text=text.slice(0,status.start+at404)+bad404.replace('404,{"content-type":"application/json"}','404,jsonHeaders()')+text.slice(status.start+at404+bad404.length)
 const admin=functionRange(text,'handleAdminRoute'),adminBody=text.slice(admin.start,admin.end),at400=one(adminBody,bad400)
 const fixed400=bad400.replace('400,{"content-type":"application/json"}','400,'+headerName+'(req.headers.origin)')
 text=text.slice(0,admin.start+at400)+fixed400+text.slice(admin.start+at400+bad400.length)
 // A function declaration is available without a temporal-dead-zone. Its body
 // is exactly the original status helper, used only after unchanged gates.
 const declaration=jsonHelper.replace('const jsonHeaders=()=>','function '+headerName+'(trustedOrigin)')
 return Buffer.from(text.slice(0,admin.start)+declaration+text.slice(admin.start))
}
export function classifyBiliStatusCors({name,version,sha256}){
 if(name!==PINS.name||version!==PINS.version)return{action:'REVIEW_UPDATE',reason:'unsupported package name or version; preserve bytes'}
 if(sha256===PINS.before)return{action:'REPAIR',reason:'exact supported original bytes'}
 if(sha256===PINS.after)return{action:'KEEP',reason:'exact supported repaired bytes'}
 return{action:'REVIEW_UPDATE',reason:'unknown code bytes; preserve local changes'}
}
const identity=stat=>({dev:String(stat.dev),ino:String(stat.ino)})
const signature=snapshot=>snapshot===null?null:(({data,...rest})=>rest)(snapshot)
const same=(a,b)=>a!==null&&b!==null&&a.dev===b.dev&&a.ino===b.ino&&a.hash===b.hash&&a.bytes===b.bytes&&a.mtimeNs===b.mtimeNs
function readFile(file,maxBytes){
 const named=fs.lstatSync(file,{bigint:true})
 if(!named.isFile()||named.isSymbolicLink())throw fail('BILI_CORS_PATH_BOUNDARY')
 if(named.size>BigInt(maxBytes))throw fail('BILI_CORS_FILE_TOO_LARGE')
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
 try{
  const opened=fs.fstatSync(fd,{bigint:true}),data=fs.readFileSync(fd),after=fs.fstatSync(fd,{bigint:true}),last=fs.lstatSync(file,{bigint:true})
  if(opened.dev!==named.dev||opened.ino!==named.ino||after.dev!==last.dev||after.ino!==last.ino||after.size!==opened.size||after.mtimeNs!==opened.mtimeNs||after.ctimeNs!==opened.ctimeNs||BigInt(data.length)!==after.size)throw fail('BILI_CORS_CONFLICT')
  return{...identity(after),bytes:data.length,hash:digest(data),mtimeNs:String(after.mtimeNs),data}
 }finally{fs.closeSync(fd)}
}
function directory(file){const info=fs.lstatSync(file,{bigint:true});if(!info.isDirectory()||info.isSymbolicLink())throw fail('BILI_CORS_PATH_BOUNDARY');return{path:file,...identity(info)}}
function bundleBoundary(requested){
 if(typeof requested!=='string'||!path.isAbsolute(requested))throw fail('BILI_CORS_ABSOLUTE_ROOT_REQUIRED')
 const bundleRoot=fs.realpathSync(requested),root=directory(bundleRoot),dist=directory(path.join(bundleRoot,'dist'))
 if(fs.realpathSync(dist.path)!==dist.path)throw fail('BILI_CORS_PATH_BOUNDARY')
 return{requestedRoot:path.resolve(requested),bundleRoot,distRoot:dist.path,tokens:[root,dist]}
}
export function planBiliStatusCors(requested){
 const boundary=bundleBoundary(requested),metadata=readFile(path.join(boundary.bundleRoot,'package.json'),131072),before=readFile(path.join(boundary.distRoot,'index.js'),8388608)
 let parsed;try{parsed=JSON.parse(metadata.data.toString('utf8'))}catch{parsed={}}
 const classification=classifyBiliStatusCors({name:parsed?.name,version:parsed?.version,sha256:before.hash}),next=classification.action==='REPAIR'?transformBiliStatusCors(before.data):undefined
 if(next&&digest(next)!==PINS.after)throw fail('BILI_CORS_PATCH_HASH')
 return{...boundary,...classification,packageName:typeof parsed?.name==='string'?parsed.name:null,version:typeof parsed?.version==='string'?parsed.version:null,metadata:signature(metadata),before:signature(before),original:before.data,next}
}
export const summarizeBiliStatusCors=plan=>({bundleRoot:plan.bundleRoot,mode:plan.mode??'REPAIR',action:plan.action,reason:plan.reason,packageName:plan.packageName,version:plan.version,originalHash:plan.before.hash,originalBytes:plan.before.bytes,nextHash:plan.next?digest(plan.next):plan.before.hash,nextBytes:plan.next?.length??plan.before.bytes,scope:'only trusted status 400/404 CORS headers; no restart, account, provider or configuration changes'})
function sameBoundary(plan){
 const current=bundleBoundary(plan.requestedRoot)
 if(current.bundleRoot!==plan.bundleRoot||JSON.stringify(current.tokens)!==JSON.stringify(plan.tokens))throw fail('BILI_CORS_PATH_CHANGED')
 if(!same(readFile(path.join(plan.bundleRoot,'package.json'),131072),plan.metadata))throw fail('BILI_CORS_METADATA_CHANGED')
}
function recheck(plan){
 sameBoundary(plan)
 if(!same(readFile(path.join(plan.distRoot,'index.js'),8388608),plan.before))throw fail('BILI_CORS_CONFLICT')
 const canonical=planBiliStatusCors(plan.requestedRoot)
 if(canonical.action!==plan.action||!canonical.original.equals(plan.original)||Boolean(canonical.next)!==Boolean(plan.next)||canonical.next&&!canonical.next.equals(plan.next))throw fail('BILI_CORS_PLAN_CHANGED')
}
function backupBoundary(requested,bundleRoot){
 if(typeof requested!=='string'||!path.isAbsolute(requested))throw fail('BILI_CORS_BACKUP_REQUIRED')
 const root=fs.realpathSync(requested),token=directory(root),relative=path.relative(bundleRoot,root)
 if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw fail('BILI_CORS_BACKUP_INSIDE_BUNDLE')
 return token
}
async function transactionAPI(){
 let cursor=ROOT
 for(const part of HELPER.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw fail('BILI_CORS_HELPER_LINK')}
 const helper=readFile(cursor,65536)
 if(helper.hash!==HELPER_SHA)throw fail('BILI_CORS_HELPER_HASH')
 const api=await import('data:text/javascript;base64,'+helper.data.toString('base64'))
 if(typeof api.publishMetadataPair!=='function')throw fail('BILI_CORS_HELPER_API')
 return api
}
function writeExclusive(file,bytes){const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function boundary(operation,verify){
 const delays=[50,100,200,400,800,1600,1850]
 for(let attempt=0;;attempt++){verify();try{return operation()}catch(error){if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=delays.length)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,delays[attempt])}}
}
/** Apply only an unmodified plan. Hardlinks are withdrawn, never overwritten.
 * The fixed helper sees an absent target, so its single-link rule is retained.
 * During the short gap users must prevent new host/package processes starting.
 */
export async function applyBiliStatusCors(plan,{backupDir,onPhase=()=>{}}={}){
 if(typeof onPhase!=='function')throw fail('BILI_CORS_INPUT')
 recheck(plan)
 if(plan.action!=='REPAIR')return{...summarizeBiliStatusCors(plan),applied:false,kept:plan.action==='KEEP',reviewRequired:plan.action==='REVIEW_UPDATE'}
 const backupRoot=backupBoundary(backupDir,plan.bundleRoot),api=await transactionAPI();recheck(plan)
 const stage=fs.mkdtempSync(path.join(plan.distRoot,'.bili-status-cors-')),stageToken=directory(stage),candidate=path.join(stage,'candidate.js'),held=path.join(stage,'previous.js'),target=path.join(plan.distRoot,'index.js')
 let withdrawn=false,committed=false,publishing=false,backupCommitted=false,backup,receipt,backupSnapshot,receiptSnapshot,helperResult
 const guard=()=>{sameBoundary(plan);if(JSON.stringify(directory(stage))!==JSON.stringify(stageToken))throw fail('BILI_CORS_STAGE_CHANGED')}
 const backupGuard=()=>{if(JSON.stringify(directory(backupRoot.path))!==JSON.stringify(backupRoot))throw fail('BILI_CORS_BACKUP_CHANGED');if(backupSnapshot&&(!same(readFile(backup,8388608),backupSnapshot)||!same(readFile(receipt,65536),receiptSnapshot)))throw fail('BILI_CORS_BACKUP_CHANGED')}
 const heldOriginal=()=>{if(!same(readFile(held,8388608),plan.before))throw fail('BILI_CORS_WITHDRAWN_PREIMAGE_CHANGED')}
 const phase=name=>{guard();onPhase({phase:name,stage});guard()}
 try{
  writeExclusive(candidate,plan.next);const candidateSnapshot=readFile(candidate,8388608)
  const checkCandidate=()=>{if(!same(readFile(candidate,8388608),candidateSnapshot))throw fail('BILI_CORS_CANDIDATE_CHANGED')}
  const prefix='bili-status-cors-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID(),backupName=prefix+'.index.js',receiptName=prefix+'.json'
  backup=path.join(backupRoot.path,backupName);receipt=path.join(backupRoot.path,receiptName)
  const record={schemaVersion:1,kind:'dsh-bili-status-cors-backup',state:'backup-before-withdraw',committed:false,packageName:PINS.name,version:PINS.version,bundleRoot:plan.bundleRoot,bundleIdentity:plan.tokens,originalHash:PINS.before,nextHash:PINS.after,originalBytes:plan.original.length,stage,previousFile:'previous.js',backupFile:backupName,createdAt:new Date().toISOString()}
  // Separate committed WX/exclusive backup transaction survives later failures.
  api.publishMetadataPair(backupRoot.path,[{name:backupName,bytes:plan.original},{name:receiptName,bytes:JSON.stringify(record,null,2)+'\n'}],{preimages:[{name:backupName,before:null},{name:receiptName,before:null}],onPhase:()=>{guard();backupGuard()}})
  backupCommitted=true;backupSnapshot=readFile(backup,8388608);receiptSnapshot=readFile(receipt,65536)
  if(backupSnapshot.hash!==PINS.before)throw fail('BILI_CORS_BACKUP_CHANGED')
  phase('backup-committed');backupGuard();recheck(plan);checkCandidate()
  phase('before-withdraw');recheck(plan)
  boundary(()=>fs.renameSync(target,held),()=>{guard();backupGuard();checkCandidate();if(!same(readFile(target,8388608),plan.before))throw fail('BILI_CORS_CONFLICT');if(fs.existsSync(held))throw fail('BILI_CORS_STAGE_CHANGED')})
  withdrawn=true;phase('after-withdraw');heldOriginal();checkCandidate()
  publishing=true
  helperResult=api.publishMetadataPair(plan.distRoot,[{name:'index.js',bytes:plan.next}],{preimages:[{name:'index.js',before:null}],onPhase:event=>{phase('publish:'+event.phase);backupGuard();heldOriginal();checkCandidate()}})
  committed=helperResult.committed===true
  if(!committed||readFile(target,8388608).hash!==PINS.after)throw fail('BILI_CORS_VERIFY')
  let cleanupError=null
  try{
   guard();heldOriginal();checkCandidate()
   if(fs.readdirSync(stage).sort().join(',')!=='candidate.js,previous.js')throw fail('BILI_CORS_UNKNOWN_STAGE_FILE')
   fs.unlinkSync(held);fs.unlinkSync(candidate);fs.rmdirSync(stage)
  }catch(error){cleanupError=error.code??'BILI_CORS_CLEANUP'}
  return{...summarizeBiliStatusCors(plan),applied:true,committed:true,backupCommitted,backup,receipt,installedHash:PINS.after,cleanupComplete:cleanupError===null,cleanupError,...cleanupError?{stage}:{}}
 }catch(error){
  // Never cover a concurrent target. Restore the withdrawn inode exclusively;
  // retain stages/backup for review when restoration or ownership is uncertain.
  committed=committed||publishing&&error.committed===true
  backupCommitted=backupCommitted||!publishing&&error.committed===true
  let restored=false,restoreError=null
  if(withdrawn&&!committed){try{boundary(()=>fs.linkSync(held,target),()=>{guard();heldOriginal();if(fs.existsSync(target))throw fail('BILI_CORS_CONCURRENT_TARGET')});restored=true}catch(restore){restoreError=restore.code??'BILI_CORS_RESTORE'}}
  error.biliCors={committed,backupCommitted,restored,restoreError,recoveryRequired:withdrawn&&!committed&&!restored,stage,backup,receipt};throw error
 }
}

function restoreInputs(plan,receiptFile,backupDir){
 const backupRoot=backupBoundary(backupDir,plan.bundleRoot)
 if(typeof receiptFile!=='string'||!path.isAbsolute(receiptFile)||path.dirname(path.resolve(receiptFile))!==backupRoot.path)throw fail('BILI_CORS_RESTORE_RECEIPT')
 const receipt=readFile(path.resolve(receiptFile),65536);let record
 try{record=JSON.parse(receipt.data.toString('utf8'))}catch{throw fail('BILI_CORS_RESTORE_RECEIPT')}
 if(record?.schemaVersion!==1||record.kind!=='dsh-bili-status-cors-backup'||record.state!=='backup-before-withdraw'||record.committed!==false||record.packageName!==PINS.name||record.version!==PINS.version||record.bundleRoot!==plan.bundleRoot||JSON.stringify(record.bundleIdentity)!==JSON.stringify(plan.tokens)||record.originalHash!==PINS.before||record.nextHash!==PINS.after||typeof record.backupFile!=='string'||!/^bili-status-cors-[A-Za-z0-9_.-]+\.index\.js$/.test(record.backupFile))throw fail('BILI_CORS_RESTORE_RECEIPT')
 const backupFile=path.join(backupRoot.path,record.backupFile),backup=readFile(backupFile,8388608)
 if(backup.hash!==PINS.before||record.originalBytes!==backup.bytes)throw fail('BILI_CORS_RESTORE_BACKUP')
 return{backupRoot,receiptFile:path.resolve(receiptFile),receipt:signature(receipt),backupFile,restoreBackup:signature(backup),restoreBytes:backup.data}
}
export function planBiliStatusCorsRestore(bundleRoot,{receiptFile,backupDir}={}){
 const plan=planBiliStatusCors(bundleRoot),inputs=restoreInputs(plan,receiptFile,backupDir)
 if(plan.action==='REVIEW_UPDATE')return{...plan,...inputs,mode:'RESTORE',next:undefined}
 if(plan.before.hash===PINS.before)return{...plan,...inputs,mode:'RESTORE',action:'KEEP',reason:'already exact original bytes',next:undefined}
 if(fs.lstatSync(path.join(plan.distRoot,'index.js'),{bigint:true}).nlink!==1n)return{...plan,...inputs,mode:'RESTORE',action:'REVIEW_UPDATE',reason:'restoration requires the repaired single-link target',next:undefined}
 return{...plan,...inputs,mode:'RESTORE',action:'RESTORE',reason:'exact repaired target and original backup receipt',next:inputs.restoreBytes}
}
function recheckRestore(plan){
 sameBoundary(plan)
 const canonical=planBiliStatusCorsRestore(plan.requestedRoot,{receiptFile:plan.receiptFile,backupDir:plan.backupRoot.path})
 if(canonical.action!==plan.action||!same(canonical.before,plan.before)||!same(canonical.receipt,plan.receipt)||!same(canonical.restoreBackup,plan.restoreBackup)||!canonical.original.equals(plan.original)||Boolean(canonical.next)!==Boolean(plan.next)||canonical.next&&!canonical.next.equals(plan.next))throw fail('BILI_CORS_RESTORE_CONFLICT')
}
export async function applyBiliStatusCorsRestore(plan,{onPhase=()=>{}}={}){
 if(typeof onPhase!=='function')throw fail('BILI_CORS_INPUT')
 recheckRestore(plan)
 if(plan.action!=='RESTORE')return{...summarizeBiliStatusCors(plan),applied:false,kept:plan.action==='KEEP',reviewRequired:plan.action==='REVIEW_UPDATE'}
 const api=await transactionAPI();recheckRestore(plan)
 const prefix='bili-status-cors-restore-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID(),backupName=prefix+'.index.js',receiptName=prefix+'.json',backup=path.join(plan.backupRoot.path,backupName),receipt=path.join(plan.backupRoot.path,receiptName)
 const guard=()=>{sameBoundary(plan);if(JSON.stringify(directory(plan.backupRoot.path))!==JSON.stringify(plan.backupRoot))throw fail('BILI_CORS_BACKUP_CHANGED');if(!same(readFile(plan.receiptFile,65536),plan.receipt)||!same(readFile(plan.backupFile,8388608),plan.restoreBackup))throw fail('BILI_CORS_RESTORE_CONFLICT')}
 let publishing=false,committed=false,backupCommitted=false,currentBackup,currentReceipt
 const currentBackupGuard=()=>{if(currentBackup&&(!same(readFile(backup,8388608),currentBackup)||!same(readFile(receipt,65536),currentReceipt)))throw fail('BILI_CORS_BACKUP_CHANGED')}
 try{
  const record={schemaVersion:1,kind:'dsh-bili-status-cors-restore-backup',state:'backup-before-restore',committed:false,bundleRoot:plan.bundleRoot,bundleIdentity:plan.tokens,originalHash:PINS.after,nextHash:PINS.before,backupFile:backupName,createdAt:new Date().toISOString()}
  api.publishMetadataPair(plan.backupRoot.path,[{name:backupName,bytes:plan.original},{name:receiptName,bytes:JSON.stringify(record,null,2)+'\n'}],{preimages:[{name:backupName,before:null},{name:receiptName,before:null}],onPhase:()=>guard()})
  backupCommitted=true;currentBackup=readFile(backup,8388608);currentReceipt=readFile(receipt,65536)
  if(currentBackup.hash!==PINS.after)throw fail('BILI_CORS_BACKUP_CHANGED')
  onPhase({phase:'restore-backup-committed'});currentBackupGuard();recheckRestore(plan);publishing=true
  // The existing fixed helper performs CAS, bounded sharing-error retries and
  // exclusive journalled publication. It sees only a verified single-link file.
  const result=api.publishMetadataPair(plan.distRoot,[{name:'index.js',bytes:plan.next}],{preimages:[{name:'index.js',before:{dev:plan.before.dev,ino:plan.before.ino,bytes:plan.before.bytes,hash:plan.before.hash}}],onPhase:event=>{guard();currentBackupGuard();onPhase({phase:'restore:'+event.phase});guard();currentBackupGuard()}})
  committed=result.committed===true
  if(readFile(path.join(plan.distRoot,'index.js'),8388608).hash!==PINS.before)throw fail('BILI_CORS_VERIFY')
  return{...summarizeBiliStatusCors(plan),applied:true,committed:true,backupCommitted,backup,receipt,installedHash:PINS.before,cleanupComplete:true,restoredHardlinkIdentity:false}
 }catch(error){error.biliCors={committed:committed||publishing&&error.committed===true,backupCommitted:backupCommitted||!publishing&&error.committed===true,backup,receipt,...error.stage?{stage:error.stage}:{}};throw error}
}
