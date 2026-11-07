// Optional, exact-version data-only runtime repair. Application modules are never imported.
// Uses footer conversion plus composer, safe HTTP403, Cordis ownership and standing-subagent lifetime repairs.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {inspectAsarLayout,encodeAsarHeader,planDshFooterArchive,ARCHIVE_PINS as FOOTER_PINS} from './dsh-footer-archive.mjs'
import control from './dsh-control-row-source.cjs'
import account from './dsh-account-forbidden-source.cjs'
import cordis from './dsh-cordis-ownership-source.cjs'
import subagent from './dsh-subagent-ownership-source.cjs'
export const RUNTIME_PINS=Object.freeze({original:FOOTER_PINS.before,footer:FOOTER_PINS.after,previous:'e8a0fcbcafb0127e4005ed0cebd56568c6a46a56f20ed4bdb4e8b8316bf1815b',previousBytes:193558502,previousR2:'90c23c91ddff8e1306cfeb17e4546e8e3e708721dd2fba5a82500d6655dc8f88',previousR2Bytes:193619745,after:'13a1ede091885c497bf7833464be356a649c19b243051fdfa394cadd21213210',afterBytes:193654185,exe:FOOTER_PINS.exe,conversation:'node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js',account:'node_modules/@deepseek-ai/dsh-deepseek-account-platform/lib/index.js',conversationBefore:'91b1b39e4ffb81ed3a8b306fdd549518f2023489e2f05aa75f35e26decb76c38',conversationAfter:'fe9764cf9fb18eb01d07f98178e104d1c1470288062e1588253507f739eaf2b2',accountBefore:'3b82b41e3e94566e43105a2552c0a4804983be39e1e16ad8b0d0646c76ec0057',accountAfter:'05afdd8cf3b8f2abb3cc7c9fd53d9340d94e217e947fac0a5fe56c0a3f929f33',cordis:cordis.FILE,cordisBefore:cordis.BEFORE,cordisAfter:cordis.AFTER,subagent:subagent.FILE,subagentBefore:subagent.BEFORE,subagentAfter:subagent.AFTER})
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),HELPER='packages/ultimate-model/scripts/metadata-transaction.mjs',HELPER_SHA='1cec233403ea8cdc84b2d0a7a038d8742bdbf110587b8e9a930cd262e778971a'
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),fail=code=>Object.assign(new Error(code),{code}),BLOCK=4194304
const signature=s=>(({data,...rest})=>rest)(s),identity=st=>({dev:String(st.dev),ino:String(st.ino)}),same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.bytes===b.bytes&&a.hash===b.hash&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs
const preimage=s=>({dev:s.dev,ino:s.ino,bytes:s.bytes,hash:s.hash}),originalHashes=[RUNTIME_PINS.original,RUNTIME_PINS.footer,RUNTIME_PINS.previous,RUNTIME_PINS.previousR2]
export function runtimeEntry(header,name){let node=header;for(const part of name.split('/')){if(!part||part==='.'||part==='..'||!node.files||!Object.hasOwn(node.files,part))throw fail('RUNTIME_STABILITY_ENTRY');node=node.files[part]}if(node.files||node.link||node.unpacked)throw fail('RUNTIME_STABILITY_PACKED_ENTRY_REQUIRED');return node}
export function runtimeIntegrity(bytes){const blocks=[];for(let i=0;i<bytes.length;i+=BLOCK)blocks.push(digest(bytes.subarray(i,i+BLOCK)));if(bytes.length%BLOCK===0)blocks.push(digest(Buffer.alloc(0)));return{algorithm:'SHA256',hash:digest(bytes),blockSize:BLOCK,blocks}}
export function appendRuntimeEntry(original,name,bytes){if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>2097152)throw fail('RUNTIME_STABILITY_MEMBER_SIZE');const parsed=inspectAsarLayout(original),header=structuredClone(parsed.header),entry=runtimeEntry(header,name);entry.offset=String(parsed.payload.length);entry.size=bytes.length;entry.integrity=runtimeIntegrity(bytes);return Buffer.concat([encodeAsarHeader(header),parsed.payload,bytes])}
export function validateRuntimeAppend(original,next,names){
 const a=inspectAsarLayout(original),b=inspectAsarLayout(next),expected=structuredClone(a.header)
 if(!b.payload.subarray(0,a.payload.length).equals(a.payload)||!Array.isArray(names)||!names.length||new Set(names).size!==names.length)throw fail('RUNTIME_STABILITY_PAYLOAD_OR_TARGETS')
 let end=a.payload.length
 for(const name of names){const old=runtimeEntry(a.header,name),now=runtimeEntry(b.header,name),copy=runtimeEntry(expected,name);const other=e=>Object.fromEntries(Object.entries(e).filter(([k])=>!['offset','size','integrity'].includes(k)))
  if(JSON.stringify(other(old))!==JSON.stringify(other(now))||Number(now.offset)!==end||!Number.isSafeInteger(Number(now.offset))||end+now.size>b.payload.length)throw fail('RUNTIME_STABILITY_ENTRY_METADATA')
  const bytes=b.payload.subarray(end,end+now.size);if(JSON.stringify(now.integrity)!==JSON.stringify(runtimeIntegrity(bytes)))throw fail('RUNTIME_STABILITY_ENTRY_INTEGRITY')
  copy.offset=now.offset;copy.size=now.size;copy.integrity=structuredClone(now.integrity);end+=now.size
 }
 if(end!==b.payload.length||JSON.stringify(expected)!==JSON.stringify(b.header))throw fail('RUNTIME_STABILITY_HEADER_OR_TAIL')
 return{changes:names,originalPayloadBytes:a.payload.length,originalPayloadExact:true,otherHeaderMetadataExact:true,unpackedEntriesUnchanged:true}
}
export function buildRuntimeArchive(baseArchive){
 const baseHash=digest(baseArchive)
 if(![RUNTIME_PINS.footer,RUNTIME_PINS.previous,RUNTIME_PINS.previousR2].includes(baseHash))throw fail('RUNTIME_STABILITY_FOOTER_BASE_PIN')
 const p=inspectAsarLayout(baseArchive),members=[...(baseHash===RUNTIME_PINS.footer?[{name:RUNTIME_PINS.conversation,before:RUNTIME_PINS.conversationBefore,after:RUNTIME_PINS.conversationAfter,transform:b=>control.buildControlRowCandidate(b).bytes},{name:RUNTIME_PINS.account,before:RUNTIME_PINS.accountBefore,after:RUNTIME_PINS.accountAfter,transform:account.buildCandidate}]:[]),...(baseHash!==RUNTIME_PINS.previousR2?[{name:RUNTIME_PINS.cordis,before:RUNTIME_PINS.cordisBefore,after:RUNTIME_PINS.cordisAfter,transform:cordis.buildCandidate}]:[]),{name:RUNTIME_PINS.subagent,before:RUNTIME_PINS.subagentBefore,after:RUNTIME_PINS.subagentAfter,transform:subagent.buildCandidate}]
 let next=baseArchive
 for(const member of members){const e=runtimeEntry(p.header,member.name),before=p.payload.subarray(Number(e.offset),Number(e.offset)+e.size);if(digest(before)!==member.before)throw fail('RUNTIME_STABILITY_SOURCE_PIN');const after=member.transform(before);if(digest(after)!==member.after)throw fail('RUNTIME_STABILITY_MEMBER_OUTPUT_PIN');next=appendRuntimeEntry(next,member.name,after)}
 validateRuntimeAppend(baseArchive,next,members.map(x=>x.name));if(digest(next)!==RUNTIME_PINS.after||next.length!==RUNTIME_PINS.afterBytes)throw fail('RUNTIME_STABILITY_OUTPUT_PIN');return next
}
export function classifyRuntimeArchive({archiveHash,exeHash,fuse,nlink,exeNlink}){
 if(exeHash!==RUNTIME_PINS.exe||fuse!=='DISABLED'||nlink!==1||exeNlink!==1)return{action:'REVIEW_UPDATE',reason:'unknown executable/fuse or non-single-link file; preserve local state'}
 if(originalHashes.includes(archiveHash))return{action:'REPAIR',reason:'exact supported original, footer-repaired or previous runtime-stability ASAR revision'}
 if(archiveHash===RUNTIME_PINS.after)return{action:'KEEP',reason:'exact runtime-stability ASAR already installed'}
 return{action:'REVIEW_UPDATE',reason:'unknown ASAR bytes or local changes; preserve files'}
}

function snapshot(file,max){
 const named=fs.lstatSync(file,{bigint:true});if(!named.isFile()||named.isSymbolicLink()||named.size>BigInt(max))throw fail('RUNTIME_STABILITY_FILE_BOUNDARY')
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
 try{const a=fs.fstatSync(fd,{bigint:true}),data=fs.readFileSync(fd),b=fs.fstatSync(fd,{bigint:true}),current=fs.lstatSync(file,{bigint:true});if(a.dev!==named.dev||a.ino!==named.ino||b.dev!==current.dev||b.ino!==current.ino||a.size!==b.size||a.mtimeNs!==b.mtimeNs||a.ctimeNs!==b.ctimeNs||BigInt(data.length)!==b.size)throw fail('RUNTIME_STABILITY_READ_CONFLICT');return{...identity(b),bytes:data.length,hash:digest(data),mtimeNs:String(b.mtimeNs),ctimeNs:String(b.ctimeNs),nlink:Number(b.nlink),data}}finally{fs.closeSync(fd)}
}
function directory(file){const st=fs.lstatSync(file,{bigint:true});if(!st.isDirectory()||st.isSymbolicLink())throw fail('RUNTIME_STABILITY_DIRECTORY_BOUNDARY');return{path:file,...identity(st)}}
function fileBoundary(file){if(typeof file!=='string'||!path.isAbsolute(file))throw fail('RUNTIME_STABILITY_ABSOLUTE_PATH_REQUIRED');const requested=path.resolve(file),parent=fs.realpathSync(path.dirname(requested));return{requested,path:path.join(parent,path.basename(requested)),parent:directory(parent)}}
function hostTokenMatches(plan){const now=fileBoundary(plan.electron.requested);if(now.path!==plan.electron.path||JSON.stringify(now.parent)!==JSON.stringify(plan.electron.parent))throw fail('RUNTIME_STABILITY_EXE_CHANGED');const st=fs.lstatSync(now.path,{bigint:true});if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1n||String(st.dev)!==plan.host.dev||String(st.ino)!==plan.host.ino||Number(st.size)!==plan.host.bytes||String(st.mtimeNs)!==plan.host.mtimeNs||String(st.ctimeNs)!==plan.host.ctimeNs)throw fail('RUNTIME_STABILITY_EXE_CHANGED')}
function boundaryMatches(plan){const now=fileBoundary(plan.target.requested);if(now.path!==plan.target.path||JSON.stringify(now.parent)!==JSON.stringify(plan.target.parent))throw fail('RUNTIME_STABILITY_TARGET_DIRECTORY_CHANGED');hostTokenMatches(plan)}
function backupBoundary(input,p){if(typeof input!=='string'||!path.isAbsolute(input))throw fail('RUNTIME_STABILITY_EXTERNAL_BACKUP_REQUIRED');const canonical=fs.realpathSync(input),token=directory(canonical);for(const parent of[p.target.parent.path,p.electron.parent.path]){const rel=path.relative(parent,canonical);if(!rel||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))throw fail('RUNTIME_STABILITY_BACKUP_INSIDE_INSTALLATION')}return token}
function assertBackupToken(t){if(JSON.stringify(directory(t.path))!==JSON.stringify(t))throw fail('RUNTIME_STABILITY_BACKUP_DIRECTORY_CHANGED')}
function fileTokenMatches(file,e){const st=fs.lstatSync(file,{bigint:true});if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1n||String(st.dev)!==e.dev||String(st.ino)!==e.ino||Number(st.size)!==e.bytes||String(st.mtimeNs)!==e.mtimeNs||String(st.ctimeNs)!==e.ctimeNs)throw fail('RUNTIME_STABILITY_RECEIPT_OR_BACKUP_CHANGED')}

export function planDshRuntimeStability({asar,electronExe}){
 const p=planDshFooterArchive({asar,electronExe});let c=classifyRuntimeArchive({archiveHash:p.before.hash,exeHash:p.host.hash,fuse:p.fuse,nlink:p.before.nlink,exeNlink:p.host.nlink})
 if(c.action!=='REVIEW_UPDATE')try{installationBoundary(p)}catch{c={action:'REVIEW_UPDATE',reason:'ASAR must be app.asar in the selected executable installation resources directory'}}
 const next=c.action==='REPAIR'?buildRuntimeArchive(p.before.hash===RUNTIME_PINS.original?p.next:p.original):undefined
 return{...p,mode:'REPAIR',...c,next}
}
export const summarizeDshRuntimeStability=p=>({mode:p.mode,action:p.action,reason:p.reason,asar:p.target.path,electronExe:p.electron.path,originalHash:p.before.hash,originalBytes:p.before.bytes,nextHash:p.next?digest(p.next):p.before.hash,nextBytes:p.next?.length??p.before.bytes,fuse:p.fuse,scope:'exact footer conversion plus four packed runtime repairs; append only missing modules from supported baselines; EXE/unpacked/config untouched; no app stop/restart',hostAckRecoveryClaimed:false,account403RecoveryClaimed:false,recurringNativeRoOwnerConfirmed:false})
function restoreInputs(p,receiptFile,backupDir){
 const backupRoot=backupBoundary(backupDir,p)
 if(typeof receiptFile!=='string'||!path.isAbsolute(receiptFile)||path.dirname(path.resolve(receiptFile))!==backupRoot.path)throw fail('RUNTIME_STABILITY_RESTORE_RECEIPT')
 const receipt=snapshot(path.resolve(receiptFile),65536);let record;try{record=JSON.parse(receipt.data)}catch{throw fail('RUNTIME_STABILITY_RESTORE_RECEIPT')}
 if(record?.schemaVersion!==1||record.kind!=='dsh-runtime-stability-applied'||record.committed!==true||record.target!==p.target.path||JSON.stringify(record.targetDirectory)!==JSON.stringify(p.target.parent)||record.exeHash!==RUNTIME_PINS.exe||!originalHashes.includes(record.beforeHash)||record.afterHash!==RUNTIME_PINS.after||typeof record.backupFile!=='string'||!/^dsh-runtime-stability-[A-Za-z0-9_.-]+\.asar$/.test(record.backupFile)||!record.targetAfter)throw fail('RUNTIME_STABILITY_RESTORE_RECEIPT')
 const backupFile=path.join(backupRoot.path,record.backupFile),backup=snapshot(backupFile,268435456)
 if(backup.nlink!==1||backup.hash!==record.beforeHash)throw fail('RUNTIME_STABILITY_RESTORE_BACKUP')
 return{backupRoot,receiptFile:path.resolve(receiptFile),receipt:signature(receipt),backupFile,restoreBackup:signature(backup),restoreBytes:backup.data,targetAfter:record.targetAfter,restoreHash:record.beforeHash}
}
export function planDshRuntimeRestore({asar,electronExe,receiptFile,backupDir}){
 const p=planDshRuntimeStability({asar,electronExe}),inputs=restoreInputs(p,receiptFile,backupDir)
 if(p.action==='REVIEW_UPDATE')return{...p,...inputs,mode:'RESTORE',next:undefined}
 if(p.before.hash===inputs.restoreHash)return{...p,...inputs,mode:'RESTORE',action:'KEEP',reason:'already exact pre-repair bytes; no restore performed',next:undefined}
 if(p.before.hash!==RUNTIME_PINS.after||!same(p.before,inputs.targetAfter))return{...p,...inputs,mode:'RESTORE',action:'REVIEW_UPDATE',reason:'target identity differs from applied receipt; preserve local changes',next:undefined}
 return{...p,...inputs,mode:'RESTORE',action:'RESTORE',reason:'exact applied target identity and pinned original backup',next:inputs.restoreBytes}
}
function installationBoundary(p){const resources=fs.realpathSync(path.join(p.electron.parent.path,'resources'));if(resources!==p.target.parent.path||path.basename(p.target.path)!=='app.asar')throw fail('RUNTIME_STABILITY_INSTALLATION_LAYOUT')}
function recheck(p){boundaryMatches(p);if(p.action!=='REVIEW_UPDATE')installationBoundary(p);if((()=>{const current=snapshot(p.target.path,268435456);return current.nlink!==1||!same(current,p.before)})())throw fail('RUNTIME_STABILITY_TARGET_CONFLICT');if(digest(p.original)!==p.before.hash||p.next&&digest(p.next)!==(p.mode==='RESTORE'?p.restoreHash:RUNTIME_PINS.after))throw fail('RUNTIME_STABILITY_PLAN_CHANGED');if(p.mode==='RESTORE'){assertBackupToken(p.backupRoot);fileTokenMatches(p.receiptFile,p.receipt);fileTokenMatches(p.backupFile,p.restoreBackup);if(p.action==='RESTORE'&&!same(p.before,p.targetAfter))throw fail('RUNTIME_STABILITY_RESTORE_CONFLICT')}}
async function transactionAPI(){let file=ROOT;for(const part of HELPER.split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw fail('RUNTIME_STABILITY_HELPER_LINK')}const helper=snapshot(file,65536);if(helper.hash!==HELPER_SHA)throw fail('RUNTIME_STABILITY_HELPER_HASH');const api=await import('data:text/javascript;base64,'+helper.data.toString('base64'));if(typeof api.publishMetadataPair!=='function')throw fail('RUNTIME_STABILITY_HELPER_API');return api}

// One temporary, task-owned read-only process checker. No DSH process is stopped.
// A per-phase request/ack keeps slow process enumeration outside the JS publication loop.
const PROCESS_CHECK_SCRIPT=String.raw`
$ErrorActionPreference='Stop'
$directory=$env:DSH_RUNTIME_CHECK_DIRECTORY
$nonce=$env:DSH_RUNTIME_CHECK_NONCE
$target=[IO.Path]::GetFullPath($env:DSH_RUNTIME_CHECK_EXE)
$image=[IO.Path]::GetFileNameWithoutExtension($target)
$imagePattern=[Management.Automation.WildcardPattern]::Escape($image)
$requestFile=Join-Path $directory 'request.json'
$stateFile=Join-Path $directory 'state.json'
$nextFile=Join-Path $directory 'state.next'
$stopFile=Join-Path $directory 'stop'
$owner=[Diagnostics.Process]::GetProcessById([int]$env:DSH_RUNTIME_CHECK_PARENT)
$null=$owner.Handle
$clock=[Diagnostics.Stopwatch]::StartNew()
$known=@{}
$lastAck=-1
$lastSample=-1000
$utf8=New-Object Text.UTF8Encoding($false)
try {
 while(-not $owner.HasExited -and -not [IO.File]::Exists($stopFile) -and $clock.ElapsedMilliseconds -lt 120000){
  $request=$null
  try{$request=([IO.File]::ReadAllText($requestFile)|ConvertFrom-Json)}catch{}
  if($null -ne $request -and $request.nonce -eq $nonce -and $request.id -is [ValueType] -and ($request.id -gt $lastAck -or $clock.ElapsedMilliseconds-$lastSample -ge 100)){
   $errors=@();$rows=@(Get-Process -Name $imagePattern -ErrorAction SilentlyContinue -ErrorVariable errors)
   $running=0;$unknown=0
   foreach($errorRecord in $errors){if(-not $errorRecord.FullyQualifiedErrorId.StartsWith('NoProcessFoundForGivenName')){$unknown++}}
   foreach($row in $rows){
    $key=[string]$row.Id
    try{$started=[string]$row.StartTime.ToUniversalTime().Ticks}catch{$unknown++;continue}
    if(-not $known.ContainsKey($key) -or $known[$key].started -ne $started){
     $category='unknown'
     try{$candidate=$row.Path;if(-not [string]::IsNullOrEmpty($candidate)){if([string]::Equals([IO.Path]::GetFullPath($candidate),$target,[StringComparison]::OrdinalIgnoreCase)){$category='target'}else{$category='unknown'}}}catch{}
     $known[$key]=@{started=$started;category=$category}
    }
    if($known[$key].category -eq 'target'){$running++}
    if($known[$key].category -eq 'unknown'){$unknown++}
   }
   $status='clear';if($unknown -gt 0){$status='unknown'};if($running -gt 0){$status='running'}
   $lastAck=[int]$request.id;$lastSample=$clock.ElapsedMilliseconds
   $state=@{schema=1;nonce=$nonce;writerPid=$PID;ack=$lastAck;status=$status;checkedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();running=$running;unknown=$unknown}
   [IO.File]::WriteAllText($nextFile,($state|ConvertTo-Json -Compress),$utf8)
   Move-Item -LiteralPath $nextFile -Destination $stateFile -Force
  }
  Start-Sleep -Milliseconds 10
 }
}catch{[IO.File]::WriteAllText((Join-Path $directory 'checker-failure.json'),(@{errorType=$_.Exception.GetType().FullName;category=$_.CategoryInfo.Category.ToString()}|ConvertTo-Json -Compress),$utf8);exit 1}finally{$owner.Dispose()}
`
export function inspectProcessCheckRecord(record,{nonce,pid,request,now=Date.now()}={}){
 if(!record||record.schema!==1||record.nonce!==nonce||record.writerPid!==pid||record.ack!==request||!Number.isFinite(record.checkedAt)||now-record.checkedAt>1500||record.checkedAt-now>250||!Number.isInteger(record.running)||record.running<0||!Number.isInteger(record.unknown)||record.unknown<0||!['clear','running','unknown'].includes(record.status))throw Object.assign(fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ'),{processCheckReason:!record?'MISSING_RECORD':record.nonce!==nonce||record.writerPid!==pid?'CHECKER_IDENTITY':record.ack!==request?'ACK_MISMATCH':now-record.checkedAt>1500||record.checkedAt-now>250?'STALE_OR_FUTURE_RECORD':'INVALID_METADATA'})
 if(record.status==='running'||record.running>0)throw fail('RUNTIME_STABILITY_APP_RUNNING')
 if(record.status!=='clear'||record.unknown>0)throw Object.assign(fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ'),{processCheckReason:'UNKNOWN_PROCESS_PATH_OR_QUERY'})
 return true
}
async function processStopGate(p,backupRoot){
 if(process.platform!=='win32')throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ')
 const root=fs.mkdtempSync(path.join(backupRoot.path,'dsh-runtime-process-check-')),owner=directory(root),nonce=crypto.randomUUID(),requestFile=path.join(root,'request.json'),stateFile=path.join(root,'state.json'),stopFile=path.join(root,'stop')
 fs.writeFileSync(requestFile,JSON.stringify({nonce,id:0}),{flag:'wx',mode:0o600});const requestOwner=signature(snapshot(requestFile,4096))
 const system=process.env.SystemRoot;if(!system||!path.isAbsolute(system))throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ')
 const executable=path.join(system,'System32/WindowsPowerShell/v1.0/powershell.exe')
 const child=spawn(executable,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(PROCESS_CHECK_SCRIPT,'utf16le').toString('base64')],{windowsHide:true,stdio:'ignore',env:{SystemRoot:system,WINDIR:system,DSH_RUNTIME_CHECK_DIRECTORY:root,DSH_RUNTIME_CHECK_NONCE:nonce,DSH_RUNTIME_CHECK_EXE:p.electron.path,DSH_RUNTIME_CHECK_PARENT:String(process.pid)}})
 let spawnError=false;child.on('error',()=>{spawnError=true});let request=0,checks=0,closed=false
 const alive=()=>{if(spawnError||!child.pid)throw Object.assign(fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ'),{processCheckReason:'CHECKER_START_FAILED'});try{process.kill(child.pid,0)}catch{throw Object.assign(fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ'),{processCheckReason:'CHECKER_EXITED'})}}
 const rootGuard=()=>{assertBackupToken(backupRoot);if(JSON.stringify(directory(root))!==JSON.stringify(owner))throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ')}
 const read=()=>{rootGuard();alive();const state=snapshot(stateFile,4096);if(state.nlink===0)throw fail('RUNTIME_STABILITY_STATE_UPDATE');if(state.nlink!==1)throw Object.assign(fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ'),{processCheckReason:'STATE_FILE_LINK_COUNT'});return JSON.parse(state.data)}
 async function close(){if(closed)return true;closed=true;try{rootGuard();fs.writeFileSync(stopFile,'stop owned read-only helper\n',{flag:'wx',mode:0o600})}catch{}const end=Date.now()+2000;while(child.exitCode===null&&child.signalCode===null&&Date.now()<end)await new Promise(r=>setTimeout(r,20));if(child.exitCode===null&&child.signalCode===null){child.kill();const end2=Date.now()+1000;while(child.exitCode===null&&child.signalCode===null&&Date.now()<end2)await new Promise(r=>setTimeout(r,20))}return child.exitCode!==null||child.signalCode!==null}
 try{
  const until=performance.now()+10000;let ready=false
  while(performance.now()<until){try{const record=read();inspectProcessCheckRecord(record,{nonce,pid:child.pid,request:0});ready=true;break}catch(e){if(e.code==='RUNTIME_STABILITY_APP_RUNNING')throw e;if(spawnError||child.exitCode!==null)throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ')}await new Promise(r=>setTimeout(r,20))}
  if(!ready)throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ')
  return{method:'owned-hidden-PowerShell-GetProcess-request-ack',evidenceDirectory:root,get checks(){return checks},check(){
   const deadline=performance.now()+2000
   const data=Buffer.from(JSON.stringify({nonce,id:++request}));let written=false
   while(performance.now()<deadline){rootGuard();alive();const named=fs.lstatSync(requestFile,{bigint:true});if(!named.isFile()||named.isSymbolicLink()||named.nlink!==1n||String(named.dev)!==requestOwner.dev||String(named.ino)!==requestOwner.ino)throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ');let fd
    try{fd=fs.openSync(requestFile,'r+');const opened=fs.fstatSync(fd,{bigint:true});if(opened.dev!==named.dev||opened.ino!==named.ino||opened.nlink!==1n)throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ');fs.ftruncateSync(fd,0);fs.writeSync(fd,data,0,data.length,0);written=true;break}catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code))throw error}finally{if(fd!==undefined)fs.closeSync(fd)}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10)
   }
   if(!written)throw Object.assign(fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ'),{processCheckReason:'REQUEST_IO_TIMEOUT'})
   while(performance.now()<deadline){try{const record=read();if(record.ack===request){inspectProcessCheckRecord(record,{nonce,pid:child.pid,request});checks++;return}}catch(e){if(['RUNTIME_STABILITY_APP_RUNNING','RUNTIME_STABILITY_PROCESS_CHECK_PREREQ'].includes(e.code))throw e;if(!['ENOENT','SyntaxError','EPERM','EBUSY','EACCES','RUNTIME_STABILITY_READ_CONFLICT','RUNTIME_STABILITY_STATE_UPDATE'].includes(e.code??e.name))throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ')}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10)}
   throw fail('RUNTIME_STABILITY_PROCESS_CHECK_PREREQ')
  },close}
 }catch(e){e.processCheckCleanup=await cleanupRuntimeProcessCheck(close);throw e}
}
export async function cleanupRuntimeProcessCheck(close){try{const complete=await close();return{cleanupComplete:complete===true,...complete===true?{}:{cleanupError:'OWNED_CHECKER_EXIT_UNCONFIRMED'}}}catch(error){return{cleanupComplete:false,cleanupError:['EPERM','EACCES','EBUSY','ESRCH'].includes(error?.code)?error.code:'OWNED_CHECKER_CLEANUP_FAILED'}}}
export function runtimeFailureState({publishing=false,targetCommitted=false,helperCommitted}={}){return{committed:targetCommitted||publishing&&helperCommitted===true?true:publishing?'unknown':false,helperCommitted:typeof helperCommitted==='boolean'?helperCommitted:null,targetMayHaveChanged:publishing,recoveryRequired:true}}
export async function applyDshRuntimeStability(p,{backupDir,onPhase=()=>{}}={}){
 if(typeof onPhase!=='function')throw fail('RUNTIME_STABILITY_INPUT');recheck(p)
 if(!['REPAIR','RESTORE'].includes(p.action))return{...summarizeDshRuntimeStability(p),applied:false,kept:p.action==='KEEP',reviewRequired:p.action==='REVIEW_UPDATE'}
 const backupRoot=backupBoundary(backupDir??p.backupRoot?.path,p),api=await transactionAPI();recheck(p)
 const gate=await processStopGate(p,backupRoot)
 const prefix='dsh-runtime-stability-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID(),backupName=prefix+'.asar',beforeName=prefix+'.backup.json',committedName=prefix+'.committed.json',backup=path.join(backupRoot.path,backupName),beforeReceipt=path.join(backupRoot.path,beforeName),receipt=path.join(backupRoot.path,committedName)
 let backupCommitted=false,publishing=false,committed=false,backupSnapshot,beforeSnapshot,result,failure
 const guard=()=>{boundaryMatches(p);installationBoundary(p);assertBackupToken(backupRoot);gate.check();if(backupSnapshot){fileTokenMatches(backup,backupSnapshot);fileTokenMatches(beforeReceipt,beforeSnapshot)}if(p.mode==='RESTORE'){fileTokenMatches(p.receiptFile,p.receipt);fileTokenMatches(p.backupFile,p.restoreBackup)}}
 const phase=event=>{try{guard();onPhase(event);guard()}catch(e){e.runtimePhase={phase:event.phase,operation:event.operation};throw e}}
 try{
  const record={schemaVersion:1,kind:'dsh-runtime-stability-backup',mode:p.mode,committed:false,state:'backup-before-target-publication',target:p.target.path,targetDirectory:p.target.parent,exeHash:RUNTIME_PINS.exe,beforeHash:p.before.hash,afterHash:digest(p.next),backupFile:backupName,createdAt:new Date().toISOString()}
  api.publishMetadataPair(backupRoot.path,[{name:backupName,bytes:p.original},{name:beforeName,bytes:JSON.stringify(record,null,2)+'\n'}],{preimages:[{name:backupName,before:null},{name:beforeName,before:null}],onPhase:event=>phase({...event,operation:'backup'})})
  backupCommitted=true;backupSnapshot=signature(snapshot(backup,268435456));beforeSnapshot=signature(snapshot(beforeReceipt,65536));if(backupSnapshot.hash!==p.before.hash||backupSnapshot.nlink!==1)throw fail('RUNTIME_STABILITY_BACKUP_CHANGED')
  phase({phase:'backup-committed',operation:'backup'});recheck(p);publishing=true
  const published=api.publishMetadataPair(p.target.parent.path,[{name:path.basename(p.target.path),bytes:p.next}],{preimages:[{name:path.basename(p.target.path),before:preimage(p.before)}],onPhase:event=>phase({...event,operation:'target'})})
  committed=published.committed===true;const after=snapshot(p.target.path,268435456);if(after.hash!==digest(p.next)||after.nlink!==1)throw fail('RUNTIME_STABILITY_POSTIMAGE_VERIFY')
  const adoption={schemaVersion:1,kind:p.mode==='RESTORE'?'dsh-runtime-stability-restored':'dsh-runtime-stability-applied',committed:true,target:p.target.path,targetDirectory:p.target.parent,targetAfter:signature(after),exeHash:RUNTIME_PINS.exe,beforeHash:p.before.hash,afterHash:after.hash,backupFile:backupName,beforeReceiptFile:beforeName,processCheck:{method:gate.method,evidenceDirectory:path.basename(gate.evidenceDirectory)},createdAt:new Date().toISOString()}
  api.publishMetadataPair(backupRoot.path,[{name:committedName,bytes:JSON.stringify(adoption,null,2)+'\n'}],{preimages:[{name:committedName,before:null}],onPhase:event=>{phase({...event,operation:'receipt'});fileTokenMatches(p.target.path,signature(after))}})
  guard();fileTokenMatches(p.target.path,signature(after))
  result={...summarizeDshRuntimeStability(p),applied:true,committed:true,backupCommitted,backup,beforeReceipt,receipt,installedHash:after.hash,processCheck:{method:gate.method,checks:gate.checks},restoredOriginalInode:false}
 }catch(error){failure=error;error.runtimeStability={...runtimeFailureState({publishing,targetCommitted:committed,helperCommitted:error.committed}),backupCommitted:backupCommitted||!publishing&&error.committed===true,backup,beforeReceipt,receipt,receiptMayNotExist:true,receiptMayNeedReconciliation:true,...error.stage?{stage:error.stage}:{}};throw error}
 finally{const cleanup=await cleanupRuntimeProcessCheck(gate.close);if(result){Object.assign(result.processCheck,cleanup);Object.assign(result,cleanup)}if(failure)failure.runtimeStability.processCheckCleanup=cleanup}
 return result
}
