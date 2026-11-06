import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const LOCAL_MEMORY_LIMITS = Object.freeze({ maxBodyBytes:16384, maxTitleBytes:256, maxTags:12, maxTagBytes:64, maxPages:256, maxHistory:3, maxStoreBytes:1048576, maxResults:20, maxSnippetBytes:384, maxQueryBytes:512, maxOutputBytes:65536 });
const KINDS = new Set(['component','concept','convention','decision','initiative','lesson','note']);
const TRUST = 'unverified-submitter-claim';
const knownErrors = new WeakSet();
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.byteLength(value,'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a,b) => a.dev === b.dev && a.ino === b.ino;
const canonicalPath = value => process.platform === 'win32' ? value.toLowerCase() : value;
function failure(code) { const e=new Error('LOCAL_MEMORY_'+code);e.code='LOCAL_MEMORY_'+code;knownErrors.add(e);return e; }
function abort(signal) { if(signal?.aborted){const e=failure('CANCELLED');e.name='AbortError';throw e;} }
function safeError(error) { return knownErrors.has(error) ? error : failure('IO'); }
function object(value, allowed, required=[]) {
  if(!value || typeof value!=='object' || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length) throw failure('INPUT');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  for(const key of Object.keys(descriptors)) if(!allowed.includes(key) || descriptors[key].get || descriptors[key].set) throw failure('INPUT');
  for(const key of required) if(!Object.hasOwn(descriptors,key)) throw failure('INPUT');
}
function integer(value,min,max,code='INPUT') { if(!Number.isSafeInteger(value)||value<min||value>max)throw failure(code);return value; }
function text(value,max,{empty=false,sensitive=true}={}) {
  if(typeof value!=='string' || bytes(value)>max || (!empty&&!value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) || Buffer.from(value).toString('utf8')!==value) throw failure('INPUT');
  if(sensitive) rejectSensitive(value);
  return value;
}
function rejectSensitive(value) {
  const s=value.normalize('NFKC');
  if(/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{8,}|\bsk-[A-Za-z0-9_-]{12,}|\bAKIA[0-9A-Z]{16}|\bgh[pousr]_[A-Za-z0-9]{20,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/iu.test(s)
    || /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|client[_-]?secret|secret|authorization)\s*[:=]\s*\S{4,}/iu.test(s)
    || /\b(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|0\.0\.0\.0)\b/u.test(s)
    || /::1\b|\b(?:fc|fd)[a-f0-9]{2}:[a-f0-9:]+|\bfe80:[a-f0-9:]+|\blocalhost\b|\b[\w.-]+\.(?:internal|local)\b/iu.test(s)
    || /(?:^|[\\/\s"'])\.(?:ssh|aws|gnupg)(?:[\\/\s"']|$)|(?:^|[\\/\s"'])\.env(?:[.\w-]*)(?:$|[\\/\s"'])|\b(?:credentials\.json|id_rsa|id_ed25519)\b|https?:\/\/[^\s/@:]+:[^\s/@]+@/iu.test(s)) throw failure('SENSITIVE');
}
function id(value) { if(typeof value!=='string'||!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(value)||['__proto__','constructor','prototype'].includes(value))throw failure('INPUT');return value; }
function sessionHash(value) { if(typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value))throw failure('ACTOR');return value; }
function stable(value) { if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value); }
function chain(root) { const a=[];let p=root;for(;;){a.unshift(p);const next=path.dirname(p);if(next===p)return a;p=next;} }
async function boundedRead(handle,maxBytes) { const buffer=Buffer.alloc(maxBytes+1);let size=0;while(size<buffer.length){const result=await handle.read(buffer,size,buffer.length-size,size);if(!result.bytesRead)break;size+=result.bytesRead;}if(size>maxBytes)throw failure('LIMIT');return buffer.subarray(0,size); }
function plainDirectory(stat) { return stat?.isDirectory()&&!stat.isSymbolicLink(); }
function plainFile(stat) { return stat?.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1n; }
function limitOptions(input={}) { object(input,Object.keys(LOCAL_MEMORY_LIMITS));const out={...LOCAL_MEMORY_LIMITS};for(const [key,value]of Object.entries(input))out[key]=integer(value,key==='maxHistory'?0:key==='maxStoreBytes'?1024:1,LOCAL_MEMORY_LIMITS[key],'LIMIT_CONFIG');return Object.freeze(out); }
function parseInput(input,L) {
  object(input,['action','id','expectedRevision','title','body','kind','tags','query','limit'],['action']);
  if(typeof input.action!=='string'||!['health','list','search','read','remember','forget'].includes(input.action))throw failure('INPUT');
  const allowed={health:['action'],list:['action','kind','limit'],search:['action','query','kind','limit'],read:['action','id'],remember:['action','id','expectedRevision','title','body','kind','tags'],forget:['action','id','expectedRevision']}[input.action];
  if(!allowed)throw failure('INPUT');object(input,allowed,['action']);const r={action:input.action};
  if(['read','forget'].includes(r.action))r.id=id(input.id);
  if(r.action==='remember'){
    r.title=text(input.title,L.maxTitleBytes).trim();r.body=text(input.body,L.maxBodyBytes);if(!KINDS.has(input.kind))throw failure('INPUT');r.kind=input.kind;
    if(input.tags!==undefined&&(!Array.isArray(input.tags)||input.tags.length>L.maxTags))throw failure('INPUT');r.tags=[...new Set((input.tags??[]).map(v=>text(v,L.maxTagBytes).trim()))];
    if(Object.hasOwn(input,'id')){r.id=id(input.id);r.expectedRevision=integer(input.expectedRevision,1,1000000);}else if(Object.hasOwn(input,'expectedRevision'))throw failure('INPUT');
  }
  if(r.action==='forget')r.expectedRevision=integer(input.expectedRevision,1,1000000);
  if(['list','search'].includes(r.action)){if(input.kind!==undefined){if(!KINDS.has(input.kind))throw failure('INPUT');r.kind=input.kind;}r.limit=input.limit===undefined?Math.min(10,L.maxResults):integer(input.limit,1,L.maxResults);}
  if(r.action==='search')r.query=text(input.query,L.maxQueryBytes);
  return Object.freeze(r);
}
function tokens(value) {
  const s=value.normalize('NFKC').toLowerCase(),out=new Set();
  for(const w of s.replace(/\p{Script=Han}/gu,' ').match(/[\p{L}\p{N}_]+/gu)??[])out.add(w.slice(0,64));
  for(const run of s.match(/\p{Script=Han}+/gu)??[]){const a=Array.from(run);if(a.length===1)out.add(a[0]);else for(let i=0;i<a.length-1;i++)out.add(a[i]+a[i+1]);}
  return out;
}
function short(value,max) { let out='',n=0;for(const c of value){const b=bytes(c);if(n+b>max)break;out+=c;n+=b;}return out; }
function summary(p) { return {id:p.id,revision:p.revision,title:p.title,kind:p.kind,tags:[...p.tags],createdAt:p.createdAt,updatedAt:p.updatedAt,tombstone:p.tombstone,sourceSessionHash:p.sourceSessionHash}; }
function snapshot(p) { const {revision,updatedAt,title,body,kind,tags,sourceSessionHash,tombstone}=p;return {revision,updatedAt,title,body,kind,tags:[...tags],sourceSessionHash,tombstone}; }
function validatePage(p,L,history=false) {
  const fields=history?['revision','updatedAt','title','body','kind','tags','sourceSessionHash','tombstone']:['id','revision','createdAt','updatedAt','title','body','kind','tags','sourceSessionHash','tombstone','history'];
  object(p,fields,fields);if(!history){id(p.id);integer(p.createdAt,0,8640000000000000,'CORRUPT');}
  integer(p.revision,1,1000000,'CORRUPT');integer(p.updatedAt,0,8640000000000000,'CORRUPT');text(p.title,L.maxTitleBytes);text(p.body,L.maxBodyBytes);if(!KINDS.has(p.kind)||typeof p.tombstone!=='boolean'||!Array.isArray(p.tags)||p.tags.length>L.maxTags)throw failure('CORRUPT');for(const tag of p.tags)text(tag,L.maxTagBytes);sessionHash(p.sourceSessionHash);
  if(!history){if(!Array.isArray(p.history)||p.history.length>L.maxHistory||p.createdAt>p.updatedAt)throw failure('CORRUPT');let previous=p.revision;for(const h of p.history){validatePage(h,L,true);if(h.revision>=previous)throw failure('CORRUPT');previous=h.revision;}}
}
function validatePayload(p,workspaceHash,L) {
  object(p,['schemaVersion','workspaceHash','generation','updatedAt','pages','checksum'],['schemaVersion','workspaceHash','generation','updatedAt','pages','checksum']);
  if(p.schemaVersion!==1)throw failure('SCHEMA');if(p.workspaceHash!==workspaceHash)throw failure('SCOPE');integer(p.generation,0,1000000,'CORRUPT');integer(p.updatedAt,0,8640000000000000,'CORRUPT');
  if(!Array.isArray(p.pages)||p.pages.length>L.maxPages)throw failure('LIMIT');const seen=new Set();for(const page of p.pages){validatePage(page,L);if(seen.has(page.id)||page.revision>p.generation)throw failure('CORRUPT');seen.add(page.id);}
  if(typeof p.checksum!=='string'||!/^[a-f0-9]{64}$/u.test(p.checksum))throw failure('CHECKSUM');const {checksum,...payload}=p;if(digest(stable(payload))!==checksum)throw failure('CHECKSUM');return payload;
}

export function createLocalMemoryStore(trustedWorkspace,options={}) {
  object(options,['authorizeMutation','now','limits']);
  if(typeof trustedWorkspace!=='string'||!path.isAbsolute(trustedWorkspace)||trustedWorkspace.includes('\0')||trustedWorkspace.length>2048||/^\\\\/u.test(trustedWorkspace))throw failure('SCOPE');
  const root=path.resolve(trustedWorkspace);if(root===path.parse(root).root)throw failure('SCOPE');
  if(root.split(/[\\/]/u).some(s=>['.ssh','.aws','.gnupg','.azure','credentials.json'].includes(s.toLowerCase())))throw failure('SCOPE');
  const L=limitOptions(options.limits),authorize=options.authorizeMutation,now=options.now??Date.now;
  if(authorize!==undefined&&typeof authorize!=='function'||typeof now!=='function')throw failure('INPUT');
  const basePins=new Map();
  try{for(const dir of chain(root)){const st=syncFs.lstatSync(dir,{bigint:true});if(!plainDirectory(st)||canonicalPath(syncFs.realpathSync.native(dir))!==canonicalPath(dir))throw failure('LINK');basePins.set(dir,st);}}catch(e){throw safeError(e);}
  const workspaceHash=digest(canonicalPath(root)),dsh=path.join(root,'.dsh'),directory=path.join(dsh,'local-memory'),file=path.join(directory,'store-v1.json'),lockFile=path.join(directory,'store-v1.lock');
  const directoryPins=new Map();let tail=Promise.resolve();
  const empty=()=>({schemaVersion:1,workspaceHash,generation:0,updatedAt:0,pages:[]});
  const gate=(phase,signal)=>{abort(signal);if(typeof authorize!=='function')throw failure('POLICY_DENIED');let result;try{result=authorize({phase});}catch{throw failure('POLICY_DENIED');}if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw failure('POLICY_SYNC_REQUIRED');}if(result===false)throw failure('POLICY_DENIED');abort(signal);};
  const statMaybe=async target=>{try{return await fs.lstat(target,{bigint:true});}catch(e){if(e.code==='ENOENT')return null;throw e;}};
  async function guardBase(){for(const [dir,pin]of basePins){const st=await statMaybe(dir);if(!plainDirectory(st)||!same(st,pin)||canonicalPath(await fs.realpath(dir))!==canonicalPath(dir))throw failure('SCOPE');}}
  async function checkDirectory(dir){const st=await statMaybe(dir);if(!st){if(directoryPins.has(dir))throw failure('DIRECTORY_DRIFT');return null;}if(!plainDirectory(st)||canonicalPath(await fs.realpath(dir))!==canonicalPath(dir))throw failure('LINK');const pin=directoryPins.get(dir);if(pin&&!same(st,pin))throw failure('DIRECTORY_DRIFT');directoryPins.set(dir,st);return st;}
  async function guardDirectories(){await guardBase();for(const dir of [dsh,directory])if(!await checkDirectory(dir))return false;return true;}
  async function ensureDirectories(signal,created){await guardBase();for(const dir of [dsh,directory]){let st=await checkDirectory(dir);if(st)continue;await guardBase();gate('mkdir',signal);try{await fs.mkdir(dir,{mode:0o700});st=await statMaybe(dir);if(!plainDirectory(st))throw failure('LINK');created.push({path:dir,id:st});directoryPins.set(dir,st);}catch(e){if(e.code!=='EEXIST')throw e;await checkDirectory(dir);}abort(signal);}}
  async function readDocument(signal){
    abort(signal);if(!await guardDirectories())return {exists:false,payload:empty(),owner:null,rawHash:null};
    const st=await statMaybe(file);if(!st)return {exists:false,payload:empty(),owner:null,rawHash:null};if(!plainFile(st))throw failure('LINK');if(st.size>BigInt(L.maxStoreBytes))throw failure('LIMIT');
    let handle;try{
      handle=await fs.open(file,syncFs.constants.O_RDONLY|(syncFs.constants.O_NOFOLLOW??0));const opened=await handle.stat({bigint:true});if(!plainFile(opened)||!same(st,opened))throw failure('IDENTITY');
      const buffer=await boundedRead(handle,Math.min(L.maxStoreBytes,Number(opened.size)));if(!Buffer.from(buffer.toString('utf8')).equals(buffer))throw failure('CORRUPT');abort(signal);const after=await handle.stat({bigint:true}),named=await statMaybe(file);
      if(!plainFile(after)||!plainFile(named)||!same(opened,after)||!same(opened,named)||opened.size!==after.size||opened.mtimeNs!==after.mtimeNs||opened.ctimeNs!==after.ctimeNs||BigInt(buffer.length)!==after.size)throw failure('IDENTITY');
      if(buffer.length>L.maxStoreBytes)throw failure('LIMIT');let parsed;try{parsed=JSON.parse(buffer.toString('utf8'));}catch{throw failure('CORRUPT');}
      let payload;try{payload=validatePayload(parsed,workspaceHash,L);}catch(e){throw knownErrors.has(e)?e:failure('CORRUPT');}
      return {exists:true,payload,owner:after,rawHash:digest(buffer)};
    }finally{if(handle)await handle.close().catch(()=>{});}
  }
  async function assertSnapshot(expected,signal){const actual=await readDocument(signal);if(actual.exists!==expected.exists||actual.exists&&(!same(actual.owner,expected.owner)||actual.rawHash!==expected.rawHash))throw failure('IDENTITY');}
  async function assertOwned(target,owner){const st=await statMaybe(target);if(!plainFile(st)||!same(st,owner))throw failure('IDENTITY');return st;}
  async function assertTempBytes(target,owner,expected) {
    const named=await assertOwned(target,owner);if(named.size!==BigInt(expected.length))throw failure('TEMP_PAYLOAD_CHANGED');let handle;
    try{handle=await fs.open(target,syncFs.constants.O_RDONLY|(syncFs.constants.O_NOFOLLOW??0));const opened=await handle.stat({bigint:true});if(!plainFile(opened)||!same(opened,owner)||opened.size!==BigInt(expected.length))throw failure('IDENTITY');const data=await boundedRead(handle,expected.length);const after=await handle.stat({bigint:true});if(!data.equals(expected)||!plainFile(after)||!same(after,owner)||after.size!==opened.size||after.mtimeNs!==opened.mtimeNs||after.ctimeNs!==opened.ctimeNs)throw failure('TEMP_PAYLOAD_CHANGED');await assertOwned(target,owner);}finally{if(handle)await handle.close().catch(()=>{});}
  }
  async function removeOwned(target,owner){if(!owner)return;try{const st=await statMaybe(target);if(st?.isFile()&&!st.isSymbolicLink()&&same(st,owner))await fs.unlink(target);}catch{/* bounded resource cleanup, never retry or delete replacement */}}
  const version=(payload,r)=>{if(!r.id)return;const page=payload.pages.find(p=>p.id===r.id);if(!page||page.revision!==r.expectedRevision)throw failure('VERSION_CONFLICT');};
  function output(value){const result={trust:TRUST,...value};if(bytes(JSON.stringify(result))>L.maxOutputBytes)throw failure('OUTPUT_LIMIT');return result;}
  async function read(r,signal){
    const s=await readDocument(signal),p=s.payload;
    if(r.action==='health')return output({action:r.action,exists:s.exists,schemaVersion:1,generation:p.generation,pages:p.pages.length,activePages:p.pages.filter(v=>!v.tombstone).length,tombstones:p.pages.filter(v=>v.tombstone).length,limits:{...L},searchMethod:'local NFKC Unicode words + Han bigrams; weighted lexical overlap, no embeddings'});
    if(r.action==='read'){const item=p.pages.find(v=>v.id===r.id);if(!item)return output({action:r.action,found:false});if(item.tombstone)return output({action:r.action,found:false,tombstone:true,id:item.id,revision:item.revision});return output({action:r.action,found:true,page:{...summary(item),body:item.body,history:item.history.map(h=>({revision:h.revision,updatedAt:h.updatedAt,title:h.title,kind:h.kind,tombstone:h.tombstone}))}});}
    const active=p.pages.filter(v=>!v.tombstone&&(!r.kind||v.kind===r.kind));
    if(r.action==='list')return output({action:r.action,items:active.sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id)).slice(0,r.limit).map(summary)});
    const query=tokens(r.query);if(!query.size)return output({action:r.action,items:[],method:'lexical-overlap'});
    const hits=[];for(const page of active){const title=tokens(page.title),tags=tokens(page.tags.join(' ')),body=tokens(page.body);let score=0,matched=0;for(const token of query){const n=(title.has(token)?5:0)+(tags.has(token)?3:0)+(body.has(token)?1:0);if(n){score+=n;matched++;}}if(score)hits.push({page,score,matched});}
    hits.sort((a,b)=>b.score-a.score||b.page.updatedAt-a.page.updatedAt||a.page.id.localeCompare(b.page.id));
    return output({action:r.action,method:'local lexical overlap; NFKC words/Han bigrams',items:hits.slice(0,r.limit).map(h=>({...summary(h.page),score:h.score,matchedTerms:h.matched,snippet:short(h.page.body,L.maxSnippetBytes)}))});
  }
  async function mutate(r,signal,actor){
    let lockHandle,tempHandle,lockOwner,tempOwner,tempFile,committed=false;const created=[];
    try{
      gate('queued',signal);sessionHash(actor);
      const preview=await readDocument(signal);version(preview.payload,r);
      await ensureDirectories(signal,created);await guardDirectories();gate('lock',signal);
      try{lockHandle=await fs.open(lockFile,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw failure('LOCKED');throw e;}
      lockOwner=await lockHandle.stat({bigint:true});await assertOwned(lockFile,lockOwner);abort(signal);gate('transaction',signal);
      const current=await readDocument(signal);version(current.payload,r);const payload=clone(current.payload);
      if(payload.generation>=1000000)throw failure('LIMIT');let timestamp;try{timestamp=now();}catch{throw failure('CLOCK');}integer(timestamp,0,8640000000000000,'CLOCK');timestamp=Math.max(timestamp,payload.updatedAt);
      let page=r.id?payload.pages.find(v=>v.id===r.id):null;
      if(r.action==='remember'){
        if(!page){if(payload.pages.length>=L.maxPages)throw failure('LIMIT');page={id:'lm_'+crypto.randomUUID().replaceAll('-',''),revision:0,createdAt:timestamp,updatedAt:timestamp,title:r.title,body:r.body,kind:r.kind,tags:[],sourceSessionHash:actor,tombstone:false,history:[]};payload.pages.push(page);}
        else page.history=[snapshot(page),...page.history].slice(0,L.maxHistory);
        if(page.revision>=1000000)throw failure('LIMIT');Object.assign(page,{revision:page.revision+1,updatedAt:timestamp,title:r.title,body:r.body,kind:r.kind,tags:[...r.tags],sourceSessionHash:actor,tombstone:false});
      }else{
        if(page.revision>=1000000)throw failure('LIMIT');page.history=[snapshot(page),...page.history].slice(0,L.maxHistory);Object.assign(page,{revision:page.revision+1,updatedAt:timestamp,sourceSessionHash:actor,tombstone:true});
      }
      payload.generation++;payload.updatedAt=timestamp;
      const encoded=Buffer.from(stable({...payload,checksum:digest(stable(payload))}));if(encoded.length>L.maxStoreBytes)throw failure('LIMIT');
      const response=output({action:r.action,status:r.action==='remember'?'stored':'tombstoned',id:page.id,revision:page.revision,committed:true,cancellationAfterCommit:false,page:summary(page)});
      await guardDirectories();await assertOwned(lockFile,lockOwner);gate('temp',signal);tempFile=path.join(directory,'store-v1.'+crypto.randomUUID()+'.tmp');tempHandle=await fs.open(tempFile,'wx+',0o600);tempOwner=await tempHandle.stat({bigint:true});await assertOwned(tempFile,tempOwner);
      await guardDirectories();gate('write',signal);await tempHandle.writeFile(encoded);gate('flush',signal);await tempHandle.sync();
      const check=Buffer.alloc(encoded.length);const readback=await tempHandle.read(check,0,check.length,0);if(readback.bytesRead!==encoded.length||!check.equals(encoded))throw failure('WRITE_READBACK');await assertOwned(tempFile,tempOwner);await tempHandle.close();tempHandle=null;
      await guardDirectories();gate('commit',signal);await assertTempBytes(tempFile,tempOwner,encoded);await assertSnapshot(current,signal);await assertOwned(lockFile,lockOwner);
      gate('rename',signal);await assertSnapshot(current,signal);await assertTempBytes(tempFile,tempOwner,encoded);gate('publish',signal);
      await fs.rename(tempFile,file);committed=true;
      const stored=await readDocument();if(!stored.exists||!same(stored.owner,tempOwner)||stored.payload.generation!==payload.generation||stored.rawHash!==digest(encoded))throw failure('COMMIT_OBSERVATION');
      response.cancellationAfterCommit=!!signal?.aborted;return response;
    }catch(e){const safe=safeError(e);if(committed){const uncertain=failure('COMMIT_STATUS_UNCERTAIN');uncertain.committed=true;Object.defineProperty(uncertain,'cause',{value:safe,enumerable:false});throw uncertain;}throw safe;}
    finally{
      if(tempHandle)await tempHandle.close().catch(()=>{});if(lockHandle)await lockHandle.close().catch(()=>{});
      await removeOwned(tempFile,tempOwner);await removeOwned(lockFile,lockOwner);
      if(!committed)for(const resource of created.reverse()){try{const st=await statMaybe(resource.path);if(plainDirectory(st)&&same(st,resource.id)){await fs.rmdir(resource.path);directoryPins.delete(resource.path);}}catch{/* only empty owned dirs, no recursive cleanup */}}
    }
  }
  async function execute(input,executionOptions={}){
    try{
      const r=parseInput(input,L);object(executionOptions,['signal','sourceSessionHash']);const {signal,sourceSessionHash}=executionOptions;
      if(signal!==undefined&&(!(signal instanceof AbortSignal)))throw failure('INPUT');abort(signal);
      if(!['remember','forget'].includes(r.action))return await read(r,signal);
      const operation=()=>mutate(r,signal,sourceSessionHash);const pending=tail.then(operation,operation);tail=pending.catch(()=>{});return await pending;
    }catch(e){throw safeError(e);}
  }
  return Object.freeze({execute,limits:L});
}
