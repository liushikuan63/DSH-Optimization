// Narrow optional app.asar repair: target JS is data, never executed.
// Pickle format: @electron/asar3.4.1 disk.js193-199, MIT.
// Fuse sentinel/state: @electron/fuses1.8.0, MIT. No fuse writes exist.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {SOURCE_PINS,transformDshFooterSource} from './dsh-footer-source.mjs'
export const ARCHIVE_PINS=Object.freeze({before:'54983f84d351499c90a5be50957065d9bd8b5188c30fc85eb0c67ef2eba0354e',after:'1c3bc0c92100688532e43173e51d93bcc07350dbcb18a9be65e5346504203fe4',exe:'af7bb5a976c658fef1627743943599053ee47316e668e2fd0ac053ece5d8dcc5',beforeBytes:192410998,afterBytes:192730969,header:'0d783b43c013d575747e97caca6b9cc9620c3e558fddf393cf4c71ed43f8a240',name:'dsh-desktop-next',version:'2.0.20-next'})
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),HELPER='packages/ultimate-model/scripts/metadata-transaction.mjs',HELPER_SHA='1cec233403ea8cdc84b2d0a7a038d8742bdbf110587b8e9a930cd262e778971a'
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),fail=code=>Object.assign(new Error(code),{code}),BLOCK=4194304
const signature=s=>(({data,...rest})=>rest)(s),identity=st=>({dev:String(st.dev),ino:String(st.ino)}),same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.bytes===b.bytes&&a.hash===b.hash&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs
const preimage=s=>({dev:s.dev,ino:s.ino,bytes:s.bytes,hash:s.hash})
export function encodeAsarHeader(header){const json=Buffer.from(JSON.stringify(header));if(json.length>16777200)throw fail('FOOTER_HEADER_SIZE');const size=8+json.length+(4-json.length%4)%4,b=Buffer.alloc(8+size);b.writeUInt32LE(4,0);b.writeUInt32LE(size,4);b.writeUInt32LE(size-4,8);b.writeUInt32LE(json.length,12);json.copy(b,16);return b}
export function inspectAsarLayout(b){
 if(!Buffer.isBuffer(b)||b.length<16||b.readUInt32LE(0)!==4)throw fail('FOOTER_HEADER_INVALID')
 const size=b.readUInt32LE(4),length=b.readUInt32LE(12)
 if(size<8||size>16777216||8+size>b.length||b.readUInt32LE(8)!==size-4||size!==8+length+(4-length%4)%4)throw fail('FOOTER_HEADER_INVALID')
 if(b.subarray(16+length,8+size).some(byte=>byte!==0))throw fail('FOOTER_HEADER_PADDING')
 let header,text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(16,16+length));header=JSON.parse(text)}catch{throw fail('FOOTER_HEADER_INVALID')}
 if(!header||typeof header!=='object'||Array.isArray(header)||!header.files||Array.isArray(header.files)||typeof header.files!=='object')throw fail('FOOTER_HEADER_INVALID')
 const payload=b.subarray(8+size);let total=0
 function walk(node){if(!node.files||Array.isArray(node.files)||typeof node.files!=='object')throw fail('FOOTER_HEADER_INVALID');for(const[name,e]of Object.entries(node.files)){if(++total>100000||!name||name==='.'||name==='..'||/[\\/\0]/.test(name)||!e||typeof e!=='object')throw fail('FOOTER_HEADER_INVALID');if(e.files)walk(e);else if(e.link)throw fail('FOOTER_ARCHIVE_LINK');else if(!Number.isSafeInteger(e.size)||e.size<0||!e.unpacked&&(typeof e.offset!=='string'||!/^\d+$/.test(e.offset)||BigInt(e.offset)+BigInt(e.size)>BigInt(payload.length)))throw fail('FOOTER_ENTRY_RANGE')}}walk(header)
 return{header,headerString:text,headerSize:size,payload}
}
const footerEntry=h=>{const e=h.files.lib?.files?.['client.js'];if(!e||e.files||e.link||e.unpacked)throw fail('FOOTER_TARGET_PACKED_REQUIRED');return e}
export function appendPackedFooter(original,client){
 if(!Buffer.isBuffer(client)||client.length<1||client.length>1048576)throw fail('FOOTER_CLIENT_SIZE')
 const parsed=inspectAsarLayout(original),header=structuredClone(parsed.header),e=footerEntry(header),blocks=[]
 for(let at=0;at<client.length;at+=BLOCK)blocks.push(digest(client.subarray(at,at+BLOCK)))
 if(client.length%BLOCK===0)blocks.push(digest(Buffer.alloc(0)))
 e.offset=String(parsed.payload.length);e.size=client.length;e.integrity={algorithm:'SHA256',hash:digest(client),blockSize:BLOCK,blocks}
 return Buffer.concat([encodeAsarHeader(header),parsed.payload,client])
}
export function embeddedIntegrityFuseState(b){const sentinel=Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'),at=b.indexOf(sentinel),wire=at+sentinel.length;if(at<0||wire+6>=b.length||b[wire]!==1||b[wire+1]<=4)return'UNKNOWN';return b[wire+6]===48?'DISABLED':b[wire+6]===49?'ENABLED':'UNKNOWN'}
export function classifyDshFooterArchive({archiveHash,exeHash,fuse,nlink}){
 if(exeHash!==ARCHIVE_PINS.exe||fuse!=='DISABLED'||nlink!==1)return{action:'REVIEW_UPDATE',reason:'unknown executable/fuse or non-single-link target; preserve files'}
 if(archiveHash===ARCHIVE_PINS.before)return{action:'REPAIR',reason:'exact supported original ASAR and executable'}
 if(archiveHash===ARCHIVE_PINS.after)return{action:'KEEP',reason:'exact supported repaired ASAR'}
 return{action:'REVIEW_UPDATE',reason:'unknown ASAR bytes; preserve local changes'}
}
function snapshot(file,max){
 const named=fs.lstatSync(file,{bigint:true});if(!named.isFile()||named.isSymbolicLink()||named.size>BigInt(max))throw fail('FOOTER_FILE_BOUNDARY')
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
 try{const a=fs.fstatSync(fd,{bigint:true}),data=fs.readFileSync(fd),b=fs.fstatSync(fd,{bigint:true}),current=fs.lstatSync(file,{bigint:true});if(a.dev!==named.dev||a.ino!==named.ino||b.dev!==current.dev||b.ino!==current.ino||a.size!==b.size||a.mtimeNs!==b.mtimeNs||a.ctimeNs!==b.ctimeNs||BigInt(data.length)!==b.size)throw fail('FOOTER_READ_CONFLICT');return{...identity(b),bytes:data.length,hash:digest(data),mtimeNs:String(b.mtimeNs),ctimeNs:String(b.ctimeNs),nlink:Number(b.nlink),data}}finally{fs.closeSync(fd)}
}
function directory(file){const st=fs.lstatSync(file,{bigint:true});if(!st.isDirectory()||st.isSymbolicLink())throw fail('FOOTER_DIRECTORY_BOUNDARY');return{path:file,...identity(st)}}
function fileBoundary(file){if(typeof file!=='string'||!path.isAbsolute(file))throw fail('FOOTER_ABSOLUTE_PATH_REQUIRED');const requested=path.resolve(file),parent=fs.realpathSync(path.dirname(requested));return{requested,path:path.join(parent,path.basename(requested)),parent:directory(parent)}}
function hostTokenMatches(plan){const now=fileBoundary(plan.electron.requested);if(now.path!==plan.electron.path||JSON.stringify(now.parent)!==JSON.stringify(plan.electron.parent))throw fail('FOOTER_EXE_CHANGED');const st=fs.lstatSync(now.path,{bigint:true});if(!st.isFile()||st.isSymbolicLink()||String(st.dev)!==plan.host.dev||String(st.ino)!==plan.host.ino||Number(st.size)!==plan.host.bytes||String(st.mtimeNs)!==plan.host.mtimeNs||String(st.ctimeNs)!==plan.host.ctimeNs)throw fail('FOOTER_EXE_CHANGED')}
function boundaryMatches(plan){const now=fileBoundary(plan.target.requested);if(now.path!==plan.target.path||JSON.stringify(now.parent)!==JSON.stringify(plan.target.parent))throw fail('FOOTER_TARGET_DIRECTORY_CHANGED');hostTokenMatches(plan)}
export function planDshFooterArchive({asar,electronExe}){
 const target=fileBoundary(asar),electron=fileBoundary(electronExe),current=snapshot(target.path,268435456),host=snapshot(electron.path,314572800),fuse=embeddedIntegrityFuseState(host.data),c=classifyDshFooterArchive({archiveHash:current.hash,exeHash:host.hash,fuse,nlink:current.nlink});let next
 if(c.action==='REPAIR'){
  if(current.bytes!==ARCHIVE_PINS.beforeBytes)throw fail('FOOTER_SOURCE_SIZE')
  const layout=inspectAsarLayout(current.data),e=footerEntry(layout.header),client=layout.payload.subarray(Number(e.offset),Number(e.offset)+e.size)
  if(digest(Buffer.from(layout.headerString))!==ARCHIVE_PINS.header||digest(client)!==SOURCE_PINS.before)throw fail('FOOTER_SOURCE_ENTRY_PIN')
  const pe=layout.header.files['package.json'];if(!pe||pe.unpacked||pe.link)throw fail('FOOTER_PACKAGE_SHAPE');const pkg=JSON.parse(layout.payload.subarray(Number(pe.offset),Number(pe.offset)+pe.size));if(pkg.name!==ARCHIVE_PINS.name||pkg.version!==ARCHIVE_PINS.version||pkg.exports?.['./client']!=='./lib/client.js')throw fail('FOOTER_PACKAGE_PIN')
  next=appendPackedFooter(current.data,transformDshFooterSource(client));if(digest(next)!==ARCHIVE_PINS.after||next.length!==ARCHIVE_PINS.afterBytes)throw fail('FOOTER_OUTPUT_PIN')
 }
 return{mode:'REPAIR',target,electron,host:signature(host),before:signature(current),original:current.data,next,fuse,...c}
}
export const summarizeDshFooterArchive=p=>({mode:p.mode,action:p.action,reason:p.reason,asar:p.target.path,electronExe:p.electron.path,originalHash:p.before.hash,originalBytes:p.before.bytes,nextHash:p.next?digest(p.next):p.before.hash,nextBytes:p.next?.length??p.before.bytes,fuse:p.fuse,scope:'one packed lib/client.js via append-only ASAR; exe/unpacked/config untouched; no stop/restart'})
function backupBoundary(input,p){if(typeof input!=='string'||!path.isAbsolute(input))throw fail('FOOTER_EXTERNAL_BACKUP_REQUIRED');const canonical=fs.realpathSync(input),token=directory(canonical);for(const parent of[p.target.parent.path,p.electron.parent.path]){const rel=path.relative(parent,canonical);if(!rel||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))throw fail('FOOTER_BACKUP_INSIDE_INSTALLATION')}return token}
function assertBackupToken(t){if(JSON.stringify(directory(t.path))!==JSON.stringify(t))throw fail('FOOTER_BACKUP_DIRECTORY_CHANGED')}
function fileTokenMatches(file,e){const st=fs.lstatSync(file,{bigint:true});if(!st.isFile()||st.isSymbolicLink()||String(st.dev)!==e.dev||String(st.ino)!==e.ino||Number(st.size)!==e.bytes||String(st.mtimeNs)!==e.mtimeNs||String(st.ctimeNs)!==e.ctimeNs)throw fail('FOOTER_RECEIPT_OR_BACKUP_CHANGED')}
function restoreInputs(p,receiptFile,backupDir){
 const backupRoot=backupBoundary(backupDir,p);if(typeof receiptFile!=='string'||!path.isAbsolute(receiptFile)||path.dirname(path.resolve(receiptFile))!==backupRoot.path)throw fail('FOOTER_RESTORE_RECEIPT')
 const receipt=snapshot(path.resolve(receiptFile),65536);let record;try{record=JSON.parse(receipt.data)}catch{throw fail('FOOTER_RESTORE_RECEIPT')}
 if(record?.schemaVersion!==1||record.kind!=='dsh-footer-layout-applied'||record.committed!==true||record.target!==p.target.path||JSON.stringify(record.targetDirectory)!==JSON.stringify(p.target.parent)||record.exeHash!==ARCHIVE_PINS.exe||record.beforeHash!==ARCHIVE_PINS.before||record.afterHash!==ARCHIVE_PINS.after||typeof record.backupFile!=='string'||!/^dsh-footer-[A-Za-z0-9_.-]+\.asar$/.test(record.backupFile)||!record.targetAfter)throw fail('FOOTER_RESTORE_RECEIPT')
 const backupFile=path.join(backupRoot.path,record.backupFile),backup=snapshot(backupFile,268435456);if(backup.hash!==ARCHIVE_PINS.before||backup.bytes!==ARCHIVE_PINS.beforeBytes)throw fail('FOOTER_RESTORE_BACKUP')
 return{backupRoot,receiptFile:path.resolve(receiptFile),receipt:signature(receipt),backupFile,restoreBackup:signature(backup),restoreBytes:backup.data,targetAfter:record.targetAfter}
}
export function planDshFooterRestore({asar,electronExe,receiptFile,backupDir}){
 const p=planDshFooterArchive({asar,electronExe}),inputs=restoreInputs(p,receiptFile,backupDir)
 if(p.action==='REVIEW_UPDATE')return{...p,...inputs,mode:'RESTORE',next:undefined}
 if(p.before.hash===ARCHIVE_PINS.before)return{...p,...inputs,mode:'RESTORE',action:'KEEP',reason:'already exact original ASAR',next:undefined}
 if(!same(p.before,inputs.targetAfter))return{...p,...inputs,mode:'RESTORE',action:'REVIEW_UPDATE',reason:'repaired file identity differs from committed receipt; preserve bytes',next:undefined}
 return{...p,...inputs,mode:'RESTORE',action:'RESTORE',reason:'exact repaired target identity and original backup',next:inputs.restoreBytes}
}
function recheck(p){boundaryMatches(p);if(!same(snapshot(p.target.path,268435456),p.before))throw fail('FOOTER_TARGET_CONFLICT');if(digest(p.original)!==p.before.hash||p.next&&digest(p.next)!==(p.mode==='RESTORE'?ARCHIVE_PINS.before:ARCHIVE_PINS.after))throw fail('FOOTER_PLAN_CHANGED');if(p.mode==='RESTORE'){assertBackupToken(p.backupRoot);fileTokenMatches(p.receiptFile,p.receipt);fileTokenMatches(p.backupFile,p.restoreBackup);if(p.action==='RESTORE'&&!same(p.before,p.targetAfter))throw fail('FOOTER_RESTORE_CONFLICT')}}
async function transactionAPI(){let file=ROOT;for(const part of HELPER.split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw fail('FOOTER_HELPER_LINK')}const helper=snapshot(file,65536);if(helper.hash!==HELPER_SHA)throw fail('FOOTER_HELPER_HASH');const api=await import('data:text/javascript;base64,'+helper.data.toString('base64'));if(typeof api.publishMetadataPair!=='function')throw fail('FOOTER_HELPER_API');return api}
export async function applyDshFooterArchive(p,{backupDir,onPhase=()=>{}}={}){
 if(typeof onPhase!=='function')throw fail('FOOTER_INPUT');recheck(p)
 if(!['REPAIR','RESTORE'].includes(p.action))return{...summarizeDshFooterArchive(p),applied:false,kept:p.action==='KEEP',reviewRequired:p.action==='REVIEW_UPDATE'}
 const backupRoot=backupBoundary(backupDir??p.backupRoot?.path,p),api=await transactionAPI();recheck(p)
 const prefix='dsh-footer-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID(),backupName=prefix+'.asar',beforeName=prefix+'.backup.json',committedName=prefix+'.committed.json',backup=path.join(backupRoot.path,backupName),beforeReceipt=path.join(backupRoot.path,beforeName),receipt=path.join(backupRoot.path,committedName)
 let backupCommitted=false,publishing=false,committed=false,backupSnapshot,beforeSnapshot
 const guard=()=>{boundaryMatches(p);assertBackupToken(backupRoot);if(backupSnapshot){fileTokenMatches(backup,backupSnapshot);fileTokenMatches(beforeReceipt,beforeSnapshot)}if(p.mode==='RESTORE'){fileTokenMatches(p.receiptFile,p.receipt);fileTokenMatches(p.backupFile,p.restoreBackup)}}
 const phase=event=>{guard();onPhase(event);guard()}
 try{
  const record={schemaVersion:1,kind:'dsh-footer-layout-backup',mode:p.mode,committed:false,state:'backup-before-target-publication',target:p.target.path,targetDirectory:p.target.parent,exeHash:ARCHIVE_PINS.exe,beforeHash:p.before.hash,afterHash:digest(p.next),backupFile:backupName,createdAt:new Date().toISOString()}
  api.publishMetadataPair(backupRoot.path,[{name:backupName,bytes:p.original},{name:beforeName,bytes:JSON.stringify(record,null,2)+'\n'}],{preimages:[{name:backupName,before:null},{name:beforeName,before:null}],onPhase:guard})
  backupCommitted=true;backupSnapshot=signature(snapshot(backup,268435456));beforeSnapshot=signature(snapshot(beforeReceipt,65536));if(backupSnapshot.hash!==p.before.hash)throw fail('FOOTER_BACKUP_CHANGED')
  phase({phase:'backup-committed'});recheck(p);publishing=true
  const result=api.publishMetadataPair(p.target.parent.path,[{name:path.basename(p.target.path),bytes:p.next}],{preimages:[{name:path.basename(p.target.path),before:preimage(p.before)}],onPhase:event=>phase({...event,operation:'target'})})
  committed=result.committed===true;const after=snapshot(p.target.path,268435456);if(after.hash!==digest(p.next)||after.nlink!==1)throw fail('FOOTER_POSTIMAGE_VERIFY')
  const adoption={schemaVersion:1,kind:p.mode==='RESTORE'?'dsh-footer-layout-restored':'dsh-footer-layout-applied',committed:true,target:p.target.path,targetDirectory:p.target.parent,targetAfter:signature(after),exeHash:ARCHIVE_PINS.exe,beforeHash:p.before.hash,afterHash:after.hash,backupFile:backupName,beforeReceiptFile:beforeName,createdAt:new Date().toISOString()}
  api.publishMetadataPair(backupRoot.path,[{name:committedName,bytes:JSON.stringify(adoption,null,2)+'\n'}],{preimages:[{name:committedName,before:null}],onPhase:()=>{guard();fileTokenMatches(p.target.path,signature(after))}})
  return{...summarizeDshFooterArchive(p),applied:true,committed:true,backupCommitted,backup,beforeReceipt,receipt,installedHash:after.hash,cleanupComplete:true,restoredOriginalInode:false}
 }catch(error){error.footer={committed:committed||publishing&&error.committed===true,backupCommitted:backupCommitted||!publishing&&error.committed===true,backup,beforeReceipt,receipt,receiptMayNotExist:true,...error.stage?{stage:error.stage}:{}};throw error}
}
