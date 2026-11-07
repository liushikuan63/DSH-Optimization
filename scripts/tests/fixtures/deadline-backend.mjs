// Test-only backend. Every path and process belongs to a nonce-named temp root.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('./deadline-app.mjs',import.meta.url));
const prefix='diagnostic-deadline-fixture-',owned=new Map();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
function marker(root){return JSON.parse(fs.readFileSync(path.join(root,'fixture-owner.json'),'utf8'));}
export function createFixturePlan(name,options={}){
  const base=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(base,prefix)),nonce=crypto.randomUUID();
  const st=fs.lstatSync(root,{bigint:true});owned.set(root,{base,nonce,dev:st.dev,ino:st.ino});
  fs.mkdirSync(path.join(root,'receipt'));
  fs.writeFileSync(path.join(root,'fixture-owner.json'),JSON.stringify({kind:'diagnostic-deadline-fixture',nonce,name}));
  const markerStat=fs.lstatSync(path.join(root,'fixture-owner.json'),{bigint:true});
  owned.get(root).marker={dev:markerStat.dev,ino:markerStat.ino,bytes:markerStat.size,hash:sha(fs.readFileSync(path.join(root,'fixture-owner.json')))};
  fs.writeFileSync(path.join(root,'options.json'),JSON.stringify(options));fs.writeFileSync(path.join(root,'target'),'NORMAL');
  fs.writeFileSync(path.join(root,'active-run.json'),JSON.stringify({runId:'prior-fixture',pid:99999999,ended:'2020-01-01T00:00:00.000Z',clean:true}));
  return{kind:'dsh-diagnostic-deadline-v1',createdAt:new Date().toISOString(),validUntil:new Date(Date.now()+120000).toISOString(),
    maxWallMs:options.schemaValidation?6000:4500,observeMs:options.schemaValidation?2200:1500,pollMs:20,operationMs:options.schemaValidation?1500:1000,
    fixtureRoot:root,receiptDirectory:path.join(root,'receipt')};
}
export function assertFixtureDependencies(plan){
  if(!Array.isArray(plan.pinnedDependencies)||!plan.pinnedDependencies.length)fail('DEPENDENCY_PLAN');
  for(const entry of plan.pinnedDependencies){
    if(!path.isAbsolute(entry.path)||!/^[a-f0-9]{64}$/.test(entry.sha256||''))fail('DEPENDENCY_PLAN');
    const st=fs.lstatSync(entry.path);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1)fail('FILE_BOUNDARY');
    if(sha(fs.readFileSync(entry.path))!==entry.sha256)fail('DEPENDENCY_PIN');
  }
}
export class FixtureBackend{
  constructor(plan){this.plan=plan;this.root=plan.fixtureRoot;this.owner=marker(this.root);this.options=JSON.parse(fs.readFileSync(path.join(this.root,'options.json'),'utf8'));this.pending=new Set();this.generation=0;this.reads=0;this.observedActiveRun=null;}
  assertEpoch(epoch){if(epoch!==this.generation)fail('OWNED_OPERATION_CANCELLED');}
  wait(ms){return new Promise((resolve,reject)=>{const item={reject,timer:null};item.timer=setTimeout(()=>{this.pending.delete(item);resolve();},ms);this.pending.add(item);});}
  async preflight(){if(fs.readFileSync(path.join(this.root,'target'),'utf8')!=='NORMAL')fail('FIXTURE_NORMAL_PIN');if(this.options.requireDependencies)assertFixtureDependencies(this.plan);}
  async snapshot(){
    this.reads++;if(this.reads===this.options.slowSnapshotAt)await this.wait(this.options.snapshotDelayMs);
    const run=JSON.parse(fs.readFileSync(path.join(this.root,'active-run.json'),'utf8'));
    if(run.clean===false&&typeof run.started==='string')this.observedActiveRun={...run};
    let rows=[];
    const p=path.join(this.root,'processes.json');if(fs.existsSync(p)){const record=JSON.parse(fs.readFileSync(p,'utf8'));if(record.nonce!==this.owner.nonce)fail('FIXTURE_IDENTITY');rows=record.rows;}
    else if(this.launch)rows=[{pid:this.launch.pid,parentPid:this.launch.parentPid,startedMs:this.launch.notBeforeMs}];
    return{run,processes:rows.filter(p=>alive(p.pid))};
  }
  compareAndSwap(before,after){
    const file=path.join(this.root,'target'),st=fs.lstatSync(file,{bigint:true}),current=fs.readFileSync(file);
    if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1n||current.toString('utf8')!==before)fail('FIXTURE_CAS_PREIMAGE');
    const tmp=path.join(this.root,'target-'+crypto.randomUUID()+'.tmp');fs.writeFileSync(tmp,after,{flag:'wx'});
    const again=fs.lstatSync(file,{bigint:true});if(st.dev!==again.dev||st.ino!==again.ino||st.ctimeNs!==again.ctimeNs||!fs.readFileSync(file).equals(current))fail('FIXTURE_CAS_CONFLICT');
    fs.renameSync(tmp,file);
  }
  async apply(){
    const epoch=this.generation;if(this.options.requireDependencies)assertFixtureDependencies(this.plan);
    await this.wait(this.options.applyDelayMs||10);this.assertEpoch(epoch);this.compareAndSwap('NORMAL','DIAGNOSTIC');
    if(this.options.requireDependencies)assertFixtureDependencies(this.plan);
    if(this.options.commitReceiptFailure)fail('COMMITTED_RECEIPT_FAILURE');
  }
  async launchDiagnostic(){
    const epoch=this.generation;if(this.options.launchDelayMs)await this.wait(this.options.launchDelayMs);this.assertEpoch(epoch);
    const notBeforeMs=Date.now(),log=fs.openSync(path.join(this.root,'fixture-app.stderr.log'),'a');
    const child=spawn(process.execPath,[app,this.root,'main',this.owner.nonce],{detached:true,stdio:['ignore','ignore',log],windowsHide:true});fs.closeSync(log);child.unref();
    this.launch={pid:child.pid,parentPid:process.pid,notBeforeMs,notAfterMs:Date.now()+1000};
    fs.writeFileSync(path.join(this.root,'launch.json'),JSON.stringify({nonce:this.owner.nonce,...this.launch}));return this.launch;
  }
  async normalQuit(){fs.writeFileSync(path.join(this.root,'quit'),this.owner.nonce);}
  async restore(){
    const s=await this.snapshot();if(s.processes.length||s.run.clean!==true)fail('FIXTURE_RESTORE_ACTIVE');
    if(this.options.requireDependencies)assertFixtureDependencies(this.plan);if(this.options.restoreError)fail('FIXTURE_RESTORE_FAILURE');
    const value=fs.readFileSync(path.join(this.root,'target'),'utf8');if(value==='DIAGNOSTIC')this.compareAndSwap('DIAGNOSTIC','NORMAL');else if(value!=='NORMAL')fail('FIXTURE_CAS_PREIMAGE');
  }
  async cancelOwnedOperations(){
    this.generation++;for(const item of this.pending){clearTimeout(item.timer);item.reject(Object.assign(new Error('OWNED_OPERATION_CANCELLED'),{code:'OWNED_OPERATION_CANCELLED'}));}this.pending.clear();await Promise.resolve();
  }
}
export async function disposeFixture(plan,{afterMarkerRead}={}){
  const root=path.resolve(plan.fixtureRoot),token=owned.get(root);if(!token)fail('CLEANUP_NOT_OWNED');
  // Validate the named root and every existing entry before reading a nonce or
  // writing a command. A copied nonce never authorizes a replaced directory.
  const guard=()=>{
    const relative=path.relative(token.base,root),st=fs.lstatSync(root,{bigint:true});
    if(!relative.startsWith(prefix)||relative.includes(path.sep)||path.isAbsolute(relative)||relative.startsWith('..')||!st.isDirectory()||st.isSymbolicLink()||st.dev!==token.dev||st.ino!==token.ino||fs.realpathSync(root)!==root)fail('CLEANUP_BOUNDARY');
    const inspect=dir=>{for(const item of fs.readdirSync(dir)){
      const file=path.join(dir,item),s=fs.lstatSync(file,{bigint:true});
      if(s.isSymbolicLink())fail('CLEANUP_ALIAS');
      if(s.isDirectory()){if(fs.realpathSync(file)!==file)fail('CLEANUP_ALIAS');inspect(file);}
      else if(!s.isFile())fail('CLEANUP_SPECIAL_FILE');else if(s.nlink!==1n)fail('CLEANUP_HARDLINK');
    }};inspect(root);
  };
  const snap=name=>{
    guard();const file=path.join(root,name),named=fs.lstatSync(file,{bigint:true});
    if(!named.isFile()||named.isSymbolicLink()||named.nlink!==1n)fail('CLEANUP_FILE_BOUNDARY');
    const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0));
    try{
      const a=fs.fstatSync(fd,{bigint:true});if(a.dev!==named.dev||a.ino!==named.ino||a.nlink!==1n)fail('CLEANUP_READ_CONFLICT');
      const bytes=fs.readFileSync(fd),b=fs.fstatSync(fd,{bigint:true}),now=fs.lstatSync(file,{bigint:true});
      if(a.dev!==b.dev||a.ino!==b.ino||a.size!==b.size||a.mtimeNs!==b.mtimeNs||a.ctimeNs!==b.ctimeNs||b.nlink!==1n||now.dev!==b.dev||now.ino!==b.ino||now.nlink!==1n)fail('CLEANUP_READ_CONFLICT');
      guard();return{data:bytes,dev:b.dev,ino:b.ino,bytes:b.size,hash:sha(bytes),mtimeNs:b.mtimeNs,ctimeNs:b.ctimeNs};
    }finally{fs.closeSync(fd);}
  };
  guard();const owner=snap('fixture-owner.json'),record=JSON.parse(owner.data);
  if(record.kind!=='diagnostic-deadline-fixture'||record.nonce!==token.nonce||owner.dev!==token.marker.dev||owner.ino!==token.marker.ino||owner.bytes!==token.marker.bytes||owner.hash!==token.marker.hash)fail('CLEANUP_IDENTITY');
  const sameOwner=()=>{
    guard();const current=snap('fixture-owner.json');
    if(['dev','ino','bytes','hash','mtimeNs','ctimeNs'].some(k=>current[k]!==owner[k]))fail('CLEANUP_MARKER_CHANGED');
  };
  // Isolated regression hook: emulate replacement after the first marker read.
  if(afterMarkerRead)await afterMarkerRead();
  sameOwner();
  const command=path.join(root,'fixture-cleanup');
  const fd=fs.openSync(command,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW??0),0o600);
  try{
    sameOwner();const st=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(command,{bigint:true});
    if(!st.isFile()||st.nlink!==1n||named.dev!==st.dev||named.ino!==st.ino||named.nlink!==1n)fail('CLEANUP_COMMAND_BOUNDARY');
    fs.writeSync(fd,token.nonce);fs.fsyncSync(fd);sameOwner();
  }finally{fs.closeSync(fd);}
  const pids=new Set();
  guard();const processes=path.join(root,'processes.json');if(fs.existsSync(processes)){const r=JSON.parse(snap('processes.json').data);if(r.nonce!==token.nonce)fail('CLEANUP_IDENTITY');r.rows.forEach(p=>pids.add(p.pid));}
  for(const name of ['launch.json','worker.json']){guard();if(fs.existsSync(path.join(root,name))){const r=JSON.parse(snap(name).data);if(r.nonce!==token.nonce)fail('CLEANUP_IDENTITY');pids.add(r.pid);}}
  const end=Date.now()+3000;while([...pids].some(alive)&&Date.now()<end)await delay(25);
  if([...pids].some(alive))fail('FIXTURE_EXIT_UNCONFIRMED');
  // No PID is killed. Unknown/reused live PIDs cause retention, never deletion.
  sameOwner();guard();
  fs.rmSync(root,{recursive:true,force:false,maxRetries:3,retryDelay:50});owned.delete(root);
}
