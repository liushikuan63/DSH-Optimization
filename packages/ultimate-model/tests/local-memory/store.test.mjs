import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLocalMemoryStore } from '../../plugins/local-memory/store.mjs';
import { fixture,actorHash } from './store-fixtures.mjs';
const fixtureByStore=new WeakMap();
const bindStore=(f,s)=>{fixtureByStore.set(s,f);return s;};
const call=async(s,input,options={})=>{const result=await s.execute(input,{sourceSessionHash:actorHash,...options});if(result.committed===true&&fixtureByStore.has(s))await fixtureByStore.get(s).capture(result);return result;};
test('minimum import+call: pure no-store reads create no derived directories',async t=>{
 const f=await fixture(t),s=createLocalMemoryStore(f.root);
 assert.equal((await call(s,{action:'health'})).exists,false);
 assert.deepEqual((await call(s,{action:'list'})).items,[]);
 assert.deepEqual((await call(s,{action:'search',query:'按钮组件'})).items,[]);
 assert.equal((await call(s,{action:'read',id:'missing'})).found,false);
 assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
});
test('actual write/restart/read/Chinese search/correction/tombstone is unverified explicit knowledge',async t=>{
 const f=await fixture(t),options={authorizeMutation:()=>{},now:()=>1000};let s=bindStore(f,createLocalMemoryStore(f.root,options));
 const a=await call(s,{action:'remember',title:'按钮组件',body:'项目按钮使用 Vue，组件路径为 src/Button.vue。',kind:'component',tags:['前端']});
 assert.equal(a.revision,1);assert.equal(a.trust,'unverified-submitter-claim');await f.capture();
 s=bindStore(f,createLocalMemoryStore(f.root,options));assert.equal((await call(s,{action:'read',id:a.id})).page.body,'项目按钮使用 Vue，组件路径为 src/Button.vue。');
 assert.equal((await call(s,{action:'search',query:'按钮'})).items[0].id,a.id);
 assert.deepEqual((await call(s,{action:'search',query:'不存在词项xyz'})).items,[]);
 assert.equal((await call(s,{action:'remember',id:a.id,expectedRevision:1,title:'按钮纠错',body:'改用 React；旧结论已更正。',kind:'decision'})).revision,2);
 assert.equal((await call(s,{action:'read',id:a.id})).page.history.length,1);
 assert.equal((await call(s,{action:'forget',id:a.id,expectedRevision:2})).revision,3);
 assert.equal((await call(s,{action:'read',id:a.id})).tombstone,true);
 assert.deepEqual((await call(s,{action:'search',query:'React'})).items,[]);
 assert.equal(await f.exists(),true);await f.capture();
});

const note=(extra={})=>({action:'remember',title:'项目决定',body:'组件采用本地明确约定。',kind:'decision',...extra});
const writable=(f,extra={})=>bindStore(f,createLocalMemoryStore(f.root,{authorizeMutation:()=>{},...extra}));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('strict action-specific schema rejects identity/path/verification overrides before any store write',async t=>{
 const f=await fixture(t),s=writable(f);
 for(const input of [note({path:'somewhere'}),note({workspace:'elsewhere'}),note({session:'fake'}),note({permissions:'full'}),note({verified:true}),note({sourceSessionHash:actorHash}),{action:'health',limit:1},{action:'read',id:'../escape'},{action:'search',query:'x',extra:true},note({id:'unknown',expectedRevision:1})])await assert.rejects(call(s,input),/LOCAL_MEMORY_(INPUT|VERSION_CONFLICT)/);
 assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
});
test('stale/unknown optimistic updates and tombstones cannot overwrite another revision',async t=>{
 const f=await fixture(t),s=writable(f),a=await call(s,note());await f.capture();
 await call(s,note({id:a.id,expectedRevision:1,body:'第一项更正。'}));const good=await fs.readFile(f.store);
 for(const input of [note({id:a.id,expectedRevision:1}),{action:'forget',id:a.id,expectedRevision:1},note({id:'unknown',expectedRevision:1}),{action:'forget',id:'unknown',expectedRevision:1}])await assert.rejects(call(s,input),/VERSION_CONFLICT/);
 assert.equal(sha(await fs.readFile(f.store)),sha(good));assert.equal((await call(s,{action:'read',id:a.id})).page.revision,2);await f.capture();
});
test('write authorization is required/synchronous but pure reads remain available',async t=>{
 const f=await fixture(t);
 for(const options of [{},{authorizeMutation:()=>false},{authorizeMutation:()=>{throw Error('raw-sensitive-error-must-not-echo');}},{authorizeMutation:async()=>true}]){
  const s=bindStore(f,createLocalMemoryStore(f.root,options));await assert.rejects(call(s,note()),e=>/^LOCAL_MEMORY_(POLICY_DENIED|POLICY_SYNC_REQUIRED)$/.test(e.message));assert.equal((await call(s,{action:'health'})).exists,false);
 }
 assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
 await assert.rejects(writable(f).execute(note()),/ACTOR/);assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
});
test('NFKC sensitive/credential/private-address input is rejected without echo or collection',async t=>{
 const f=await fixture(t),s=writable(f);
 for(const body of ['password=fake-sensitive-value','ａｐｉ＿ｋｅｙ=synthetic-value','示例地址 10.11.12.13','-----BEGIN PRIVATE KEY----- synthetic','读取 .ssh/id_ed25519','Bearer synthetic-token-value']){
  await assert.rejects(call(s,note({body})),e=>e.message==='LOCAL_MEMORY_SENSITIVE');
 }
 assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
});
test('scope A/B stays isolated and copying a valid A blob into B is rejected',async t=>{
 const a=await fixture(t),b=await fixture(t),sa=writable(a),sb=writable(b);const item=await call(sa,note({body:'Alpha独有知识。'}));await a.capture();
 assert.deepEqual((await call(sb,{action:'search',query:'Alpha'})).items,[]);assert.equal((await call(sb,{action:'read',id:item.id})).found,false);
 await fs.mkdir(path.join(b.root,'.dsh'));await fs.mkdir(b.local);await fs.copyFile(a.store,b.store);await b.ownFile(b.store);await b.capture();await assert.rejects(call(sb,{action:'health'}),/SCOPE/);
});
test('NFKC English words/Han bigrams, kind filter and UTF8 snippets are bounded',async t=>{
 const f=await fixture(t),s=writable(f,{limits:{maxResults:1,maxSnippetBytes:12}});const a=await call(s,note({title:'React按钮组件',body:'按钮组件使用 React 运行；中文内容更多。',kind:'component'}));await call(s,note({title:'其他约定',body:'React conventions',kind:'convention'}));
 const r=await call(s,{action:'search',query:'Ｒｅａｃｔ',kind:'component',limit:1});assert.equal(r.items.length,1);assert.equal(r.items[0].id,a.id);assert.ok(Buffer.byteLength(r.items[0].snippet)<=12);assert.ok(!r.items[0].snippet.includes('\ufffd'));assert.equal((await call(s,{action:'search',query:'按钮'})).items.length,1);await f.capture();
});
test('bounded history/page/tombstone limits have legal write positives',async t=>{
 const f=await fixture(t),s=writable(f,{limits:{maxPages:1,maxHistory:1}});const a=await call(s,note());await call(s,note({id:a.id,expectedRevision:1,body:'修订二。'}));await call(s,note({id:a.id,expectedRevision:2,body:'修订三。'}));
 const read=await call(s,{action:'read',id:a.id});assert.equal(read.page.history.length,1);assert.equal(read.page.history[0].revision,2);
 await call(s,{action:'forget',id:a.id,expectedRevision:3});const prior=await fs.readFile(f.store);await assert.rejects(call(s,note({title:'另一页'})),/LIMIT/);assert.deepEqual(await fs.readFile(f.store),prior);
 const disk=JSON.parse(prior);assert.equal(disk.pages[0].tombstone,true);assert.equal(disk.pages[0].body,'修订三。');await f.capture();
});
test('body UTF8 boundary and total-store bytes reject overflow preserving last good bytes',async t=>{
 const f=await fixture(t),s=writable(f,{limits:{maxBodyBytes:16,maxStoreBytes:1024}});const a=await call(s,note({body:'你'.repeat(5)+'x'}));const good=await fs.readFile(f.store);
 await assert.rejects(call(s,note({id:a.id,expectedRevision:1,body:'你'.repeat(5)+'xx'})),/INPUT/);assert.equal(sha(await fs.readFile(f.store)),sha(good));
 const tstore=writable(f,{limits:{maxStoreBytes:1024}});await assert.rejects(call(tstore,note({id:a.id,expectedRevision:1,body:'x'.repeat(900)})),/LIMIT/);assert.equal(sha(await fs.readFile(f.store)),sha(good));await f.capture();
});
test('checksum corruption, future schema and oversized blobs do not masquerade as empty',async t=>{
 const f=await fixture(t),s=writable(f);await call(s,note());const good=await fs.readFile(f.store),doc=JSON.parse(good);doc.generation++;await fs.writeFile(f.store,JSON.stringify(doc));await assert.rejects(call(s,{action:'health'}),/CHECKSUM/);
 doc.schemaVersion=9;await fs.writeFile(f.store,JSON.stringify(doc));await assert.rejects(call(s,{action:'list'}),/SCHEMA/);
 await fs.writeFile(f.store,Buffer.alloc(1048577,32));await assert.rejects(call(s,{action:'health'}),/LIMIT/);await f.capture();
});
test('hardlinked current store is refused and external alias bytes are not changed',async t=>{
 const f=await fixture(t),s=writable(f);const a=await call(s,note());const alias=path.join(f.local,'foreign-link.bin');await fs.link(f.store,alias);await f.ownFile(alias);const prior=await fs.readFile(alias);
 await assert.rejects(call(s,{action:'health'}),/LINK/);await assert.rejects(call(s,note({id:a.id,expectedRevision:1})),/LINK/);assert.deepEqual(await fs.readFile(alias),prior);await f.capture();
});
test('junction in private ancestor fails closed without following to outside workspace',async t=>{
 const f=await fixture(t),other=await fixture(t);const junction=path.join(f.root,'.dsh');await fs.symlink(other.root,junction,'junction');await f.ownFile(junction);const s=createLocalMemoryStore(f.root,{authorizeMutation:()=>{}});
 await assert.rejects(call(s,{action:'health'}),/LINK/);await assert.rejects(call(s,note()),/LINK/);assert.equal(await other.exists(path.join(other.root,'local-memory')),false);
});
test('callback/seq change between authorization phases prevents pending write and cleans owned resources',async t=>{
 const f=await fixture(t);let seq=1;const s=createLocalMemoryStore(f.root,{authorizeMutation:({phase})=>{if(seq!==1)throw Error('changed');if(phase==='write')queueMicrotask(()=>{seq=2;});}});
 await assert.rejects(call(s,note()),/POLICY_DENIED/);assert.equal(await f.exists(),false);assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
});
test('policy change queued before first mkdir does not create derived directories',async t=>{
 const f=await fixture(t);let writableNow=true;const s=createLocalMemoryStore(f.root,{authorizeMutation:({phase})=>{if(!writableNow)throw Error('readonly');if(phase==='queued')queueMicrotask(()=>{writableNow=false;});}});
 await assert.rejects(call(s,note()),/POLICY_DENIED/);assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
});
test('abort before commit and queued abort do not become retry or persisted notes',async t=>{
 const f=await fixture(t),controller=new AbortController();const s=createLocalMemoryStore(f.root,{authorizeMutation:({phase})=>{if(phase==='commit')controller.abort();}});
 await assert.rejects(call(s,note(),{signal:controller.signal}),{name:'AbortError'});assert.equal(await f.exists(),false);
 const s2=writable(f),one=call(s2,note({title:'保留正例'})),c=new AbortController(),two=call(s2,note({title:'取消排队'}),{signal:c.signal});const rejected=assert.rejects(two,{name:'AbortError'});c.abort();await one;await rejected;assert.equal((await call(s2,{action:'list'})).items.length,1);await f.capture();
});
test('foreign lock and temp replacements are preserved rather than deleted by cleanup',async t=>{
 for(const resource of ['lock','temp']){
  const f=await fixture(t);let replaced,heldPath;
  const s=createLocalMemoryStore(f.root,{authorizeMutation:({phase})=>{
   if(phase!==(resource==='lock'?'transaction':'commit'))return;
   const local=path.join(f.root,'.dsh','local-memory');const source=resource==='lock'?path.join(local,'store-v1.lock'):path.join(local,syncFs.readdirSync(local).find(n=>n.endsWith('.tmp')));const held=path.join(local,'held-'+resource+'.bin');syncFs.renameSync(source,held);syncFs.writeFileSync(source,'foreign-marker',{flag:'wx'});replaced=source;heldPath=held;throw Error('must not echo raw marker');
  }});
  await assert.rejects(call(s,note()),e=>e.message==='LOCAL_MEMORY_POLICY_DENIED');assert.equal(await fs.readFile(replaced,'utf8'),'foreign-marker');await f.ownFile(replaced);await f.ownFile(heldPath);await f.capture();
 }
});
test('foreign target at commit is not overwritten or removed',async t=>{
 const f=await fixture(t),s=writable(f),a=await call(s,note());await f.capture();let moved=false;
 const guarded=createLocalMemoryStore(f.root,{authorizeMutation:({phase})=>{if(phase==='commit'&&!moved){syncFs.renameSync(f.store,path.join(f.local,'held-store.bin'));syncFs.writeFileSync(f.store,'foreign-store',{flag:'wx'});moved=true;}}});
 await assert.rejects(call(guarded,note({id:a.id,expectedRevision:1})),/CORRUPT/);assert.equal(await fs.readFile(f.store,'utf8'),'foreign-store');await f.ownFile(f.store);await f.ownFile(path.join(f.local,'held-store.bin'));await f.capture();
});
test('existing lock is never cleared and competing updates cannot both commit same revision',async t=>{
 const f=await fixture(t),s=writable(f),a=await call(s,note());await f.capture();await fs.writeFile(f.lock,'foreign-lock',{flag:'wx'});await f.ownFile(f.lock);const good=await fs.readFile(f.store);
 await assert.rejects(call(s,note({id:a.id,expectedRevision:1})),/LOCKED/);assert.equal(await fs.readFile(f.lock,'utf8'),'foreign-lock');assert.equal(sha(await fs.readFile(f.store)),sha(good));await fs.unlink(f.lock);
 const x=writable(f),y=writable(f),results=await Promise.allSettled([call(x,note({id:a.id,expectedRevision:1,body:'更新甲。'})),call(y,note({id:a.id,expectedRevision:1,body:'更新乙。'}))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await call(s,{action:'read',id:a.id})).page.revision,2);await f.capture();
});
test('trusted constructor has no root/path fallback and limits cannot be raised',async t=>{
 for(const root of [undefined,'', '.',path.parse(process.cwd()).root])assert.throws(()=>createLocalMemoryStore(root),/SCOPE/);
 const f=await fixture(t);assert.throws(()=>createLocalMemoryStore(f.root,{limits:{maxBodyBytes:16385}}),/LIMIT_CONFIG/);assert.throws(()=>createLocalMemoryStore(f.root,{limits:{unexpected:2}}),/INPUT/);
});



test('same-inode temp byte tampering is rejected before replacing last good store',async t=>{
 const f=await fixture(t),base=writable(f),a=await call(base,note());await f.capture();const good=await fs.readFile(f.store);
 const s=createLocalMemoryStore(f.root,{authorizeMutation:({phase})=>{if(phase==='commit'){const leaf=syncFs.readdirSync(f.local).find(n=>n.endsWith('.tmp'));syncFs.writeFileSync(path.join(f.local,leaf),'tampered');}}});
 await assert.rejects(call(s,note({id:a.id,expectedRevision:1})));assert.equal(sha(await fs.readFile(f.store)),sha(good));await f.capture();
});
test('response budget rejection happens before durable commit, not after claiming a failed write',async t=>{
 const f=await fixture(t),s=writable(f,{limits:{maxOutputBytes:128}});await assert.rejects(call(s,note()),/OUTPUT_LIMIT/);assert.equal(await f.exists(),false);
});

test('invalid raw UTF8 cannot pass by decoding to a legitimate replacement character',async t=>{
 const f=await fixture(t),s=writable(f);await call(s,note({body:'\ufffdmarker'}));const good=await fs.readFile(f.store),needle=Buffer.from('\ufffdmarker'),position=good.indexOf(needle);assert.ok(position>=0);const bad=Buffer.concat([good.subarray(0,position),Buffer.from([255]),good.subarray(position+3)]);await fs.writeFile(f.store,bad);await assert.rejects(call(s,{action:'health'}),/CORRUPT/);await f.capture();
});
test('reading existing knowledge never invokes mutation authorization or changes bytes',async t=>{
 const f=await fixture(t),s=writable(f),a=await call(s,note());await f.capture();const good=await fs.readFile(f.store);let calls=0;const reader=createLocalMemoryStore(f.root,{authorizeMutation:()=>{calls++;throw Error('must never be asked for reads');}});
 for(const input of [{action:'health'},{action:'list'},{action:'search',query:'组件'},{action:'read',id:a.id}])await call(reader,input);assert.equal(calls,0);assert.equal(sha(await fs.readFile(f.store)),sha(good));
});

test('fixture ledger cannot adopt a replacement through default capture or teardown',async t=>{
 const f=await fixture(t),s=writable(f);await call(s,note());const pinned=f.files.get(f.store),held=path.join(f.local,'held-ledger.bin');await fs.rename(f.store,held);await f.ownFile(held);await fs.writeFile(f.store,'test-created-foreign',{flag:'wx'});
 await assert.rejects(f.capture(),/Unexpected fixture file replacement/);assert.equal(f.files.get(f.store).ino,pinned.ino);assert.equal(f.files.get(f.store).dev,pinned.dev);assert.equal(await fs.readFile(f.store,'utf8'),'test-created-foreign');
 // Only the test that actually created this foreign file may register it now.
 await f.ownFile(f.store);await f.capture();
});


for(const scenario of ['corrupt-after-rename','unobservable-after-rename'])test('post-rename failure is explicit COMMIT_STATUS_UNCERTAIN: '+scenario,async t=>{
 const f=await fixture(t),s=writable(f),a=await call(s,note());const good=await fs.readFile(f.store);const rawRename=fs.rename,rawOpen=fs.open;let published=false,publishedId,error;
 try{
  fs.rename=async(from,to)=>{assert.equal(path.resolve(to),path.resolve(f.store));assert.equal(path.dirname(from),f.local);assert.ok(from.endsWith('.tmp'));const sourceId=await fs.lstat(from,{bigint:true});await rawRename(from,to);const targetId=await fs.lstat(to,{bigint:true});assert.equal(targetId.ino,sourceId.ino);assert.equal(targetId.dev,sourceId.dev);published=true;publishedId=targetId;if(scenario==='corrupt-after-rename')await fs.writeFile(to,'synthetic-corrupted-after-publish');};
  fs.open=async(file,...args)=>{if(published&&scenario==='unobservable-after-rename'&&path.resolve(String(file))===path.resolve(f.store))throw Error('synthetic-readback-unavailable');return rawOpen(file,...args);};
  await assert.rejects(call(s,note({id:a.id,expectedRevision:1,body:'synthetic-input-marker-not-in-error'})),e=>{error=e;return e.message==='LOCAL_MEMORY_COMMIT_STATUS_UNCERTAIN'&&e.code==='LOCAL_MEMORY_COMMIT_STATUS_UNCERTAIN';});
 }finally{
  fs.rename=rawRename;fs.open=rawOpen;
  if(published){const actual=await fs.lstat(f.store,{bigint:true});assert.equal(actual.ino,publishedId.ino);assert.equal(actual.dev,publishedId.dev);await f.ownFile(f.store);}
 }
 assert.equal(published,true);assert.notEqual(sha(await fs.readFile(f.store)),sha(good));assert.equal(error.cause.code,scenario==='corrupt-after-rename'?'LOCAL_MEMORY_CORRUPT':'LOCAL_MEMORY_IO');const publicError=String(error)+' '+JSON.stringify(error);assert.ok(!publicError.includes('synthetic-input-marker-not-in-error'));assert.ok(!publicError.includes(actorHash));
 if(scenario==='unobservable-after-rename'){const disk=JSON.parse(await fs.readFile(f.store,'utf8'));assert.equal(disk.pages[0].revision,2);assert.equal(disk.pages[0].body,'synthetic-input-marker-not-in-error');}await f.capture();
});
test('output budget, seq denial and precommit abort retain their own errors, never uncertain',async t=>{
 const f=await fixture(t);await assert.rejects(call(writable(f,{limits:{maxOutputBytes:128}}),note()),e=>e.message==='LOCAL_MEMORY_OUTPUT_LIMIT'&&e.committed!==true);
 let seq=1;const s=createLocalMemoryStore(f.root,{authorizeMutation:({phase})=>{if(seq!==1)throw Error('changed');if(phase==='queued')queueMicrotask(()=>{seq=2;});}});await assert.rejects(call(s,note()),e=>e.message==='LOCAL_MEMORY_POLICY_DENIED'&&e.committed!==true);
 const c=new AbortController();c.abort();await assert.rejects(call(writable(f),note(),{signal:c.signal}),e=>e.name==='AbortError'&&e.message==='LOCAL_MEMORY_CANCELLED'&&e.committed!==true);assert.equal(await f.exists(),false);assert.equal(await f.exists(path.join(f.root,'.dsh')),false);
});

test('fixture rejects replay of a genuine consumed receipt onto identical bytes in a foreign inode',async t=>{
 const f=await fixture(t),s=writable(f),receipt=await call(s,note());const pinA=f.files.get(f.store),bytesA=await fs.readFile(f.store),held=path.join(f.local,'held-receipt-a.bin');await fs.rename(f.store,held);await f.ownFile(held);await fs.writeFile(f.store,bytesA,{flag:'wx'});const createdB=await fs.lstat(f.store,{bigint:true});assert.notEqual(createdB.ino,pinA.ino);
 try{
  await assert.rejects(f.capture(receipt),/receipt.*replay/i);assert.equal(f.files.get(f.store).ino,pinA.ino);assert.equal(f.files.get(f.store).dev,pinA.dev);assert.equal(await f.exists(f.store),true);assert.equal(sha(await fs.readFile(f.store)),sha(bytesA));
  await assert.rejects(f.capture({...receipt}),/receipt.*replay/i);assert.equal(f.files.get(f.store).ino,pinA.ino);
 }finally{
  const actual=await fs.lstat(f.store,{bigint:true});assert.equal(actual.ino,createdB.ino);assert.equal(actual.dev,createdB.dev);await f.ownFile(f.store); // this test created B; never an automatic receipt adoption
 }
 await f.capture();
});

