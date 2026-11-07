import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runGuard} from '../lib/diagnostic-deadline.mjs';
import {FixtureBackend,createFixturePlan,disposeFixture} from './fixtures/deadline-backend.mjs';
import crypto from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const setup=(name,options={})=>createFixturePlan(name,options);
const cleanup=plan=>disposeFixture(plan);
const ownedPidAlive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
async function awaitOwnedHostReady(plan,backend,launch){
  const until=Date.now()+3000,readyFile=path.join(plan.fixtureRoot,'host-ready.json'),nonce=JSON.parse(fs.readFileSync(path.join(plan.fixtureRoot,'fixture-owner.json'),'utf8')).nonce;
  do{
    const state=await backend.snapshot(),host=state.processes.find(p=>p.parentPid===launch.pid);
    if(state.run.pid===launch.pid&&host&&fs.existsSync(readyFile)){
      const st=fs.lstatSync(readyFile);assert.ok(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1);
      let ready;try{ready=JSON.parse(fs.readFileSync(readyFile,'utf8'));}catch(error){if(!(error instanceof SyntaxError))throw error;}
      if(ready){assert.equal(ready.nonce,nonce);assert.equal(ready.pid,host.pid);assert.equal(ready.parentPid,launch.pid);assert.ok(ready.readyAt>=launch.notBeforeMs&&ready.readyAt<=Date.now()+1000);return state;}
    }
    await delay(20);
  }while(Date.now()<until);
  assert.fail('FIXTURE_HOST_READY_TIMEOUT');
}
async function run(name,options,verify){const p=setup(name,options);try{const r=await runGuard(p,new FixtureBackend(p));await verify(r,p);}finally{await cleanup(p);}}
test('real process closes by normal command and restores before deadline',async()=>run('normal',{},(r,p)=>{
  assert.equal(r.status,'PASS');assert.equal(r.runBound,true);assert.equal(r.forceKillDsh,false);assert.equal(r.withinDeadline,true);
  assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'quit-observed'),'utf8'),'normal-command');
  assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'NORMAL');
  const ended=JSON.parse(fs.readFileSync(path.join(p.fixtureRoot,'active-run.json')));
  assert.deepEqual(Object.keys(ended).sort(),['runId','pid','ended','clean'].sort());assert.equal(ended.clean,true);assert.ok(!Object.hasOwn(ended,'started'));
}));
test('independent guardian survives its short-lived coordinator exit',async()=>{
  const p=setup('orphan',{}),file=path.join(p.fixtureRoot,'plan.json');fs.writeFileSync(file,JSON.stringify(p));
  // Coordinator exits immediately after starting a detached guardian.
  const script="const {spawn}=require('node:child_process');const p=spawn(process.execPath,[process.argv[1],process.argv[2]],{detached:true,stdio:'ignore',windowsHide:true});p.unref();";
  const coordinator=spawn(process.execPath,['-e',script,path.join(here,'fixtures','deadline-worker.mjs'),file],{stdio:'ignore',windowsHide:true});
  await new Promise(resolve=>coordinator.once('exit',resolve));
  try{
    const until=Date.now()+8000,result=path.join(p.receiptDirectory,'result.json');
    while(!fs.existsSync(result)&&Date.now()<until)await delay(40);
    assert.ok(fs.existsSync(result));const r=JSON.parse(fs.readFileSync(result));assert.equal(r.status,'PASS');assert.equal(r.coordinatorRequiredAfterArm,false);
  }finally{await cleanup(p);}
});
test('hung app reaches hard deadline, does not restore or OS-kill app',async()=>run('hang',{hang:true},(r,p)=>{
  assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,false);assert.equal(r.quitAttempted,true);assert.match(r.failure,/HARD_DEADLINE|OPERATION_TIMEOUT|EXIT_UNCONFIRMED/);
  assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'DIAGNOSTIC');
  const s=new FixtureBackend(p);return s.snapshot().then(x=>assert.ok(x.processes.length));
}));
test('late startup is refused and never targets an unbound runtime',async()=>run('late',{startDelayMs:3500},(r)=>{
  assert.equal(r.status,'FAIL');assert.equal(r.runBound,false);assert.equal(r.quitAttempted,false);assert.equal(r.normalRestored,false);assert.match(r.failure,/START_NOT_CONFIRMED/);
}));
test('changed runtime identity is never closed or restored',async()=>run('identity',{changeIdentity:true},(r,p)=>{
  assert.equal(r.status,'FAIL');assert.equal(r.quitAttempted,false);assert.equal(r.normalRestored,false);assert.match(r.failure,/RUN_IDENTITY_CHANGED/);
  assert.equal(fs.existsSync(path.join(p.fixtureRoot,'quit')),false);
}));
test('restore failure is retained, not reported as repaired',async()=>run('restore-error',{restoreError:true},r=>{
  assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,false);assert.equal(r.withinDeadline,true);assert.match(r.failure,/FIXTURE_RESTORE_FAILURE/);
}));
test('existing app prevents apply and no quit is sent',async()=>{
  const p=setup('existing',{}),backend=new FixtureBackend(p);await backend.launchDiagnostic();await delay(150);
  try{const r=await runGuard(p,backend);assert.equal(r.status,'FAIL');assert.equal(r.armed,false);assert.equal(r.diagnosticApplied,false);assert.equal(r.quitAttempted,false);assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'NORMAL');}
  finally{await cleanup(p);}
});
test('unclean exit prevents restore',async()=>run('unclean',{unclean:true,schemaValidation:true},(r,p)=>{
  assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,false);assert.match(r.failure,/SHUTDOWN_NOT_CLEAN|RUN_IDENTITY_CHANGED/);
  const ended=JSON.parse(fs.readFileSync(path.join(p.fixtureRoot,'active-run.json')));assert.equal(ended.clean,false);assert.ok(!Object.hasOwn(ended,'started'));assert.equal(typeof ended.ended,'string');
}));
test('expired plan is refused before arming',async()=>{
  const p=setup('expired',{});p.validUntil='2000-01-01T00:00:00.000Z';
  try{await assert.rejects(()=>runGuard(p,new FixtureBackend(p)),{code:'PLAN_EXPIRED'});assert.equal(fs.existsSync(path.join(p.receiptDirectory,'journal.jsonl')),false);}
  finally{await cleanup(p);}
});
test('receipt replay refuses even an otherwise valid plan',async()=>{
  const p=setup('replay',{});fs.writeFileSync(path.join(p.receiptDirectory,'journal.jsonl'),'prior attempt\n');
  try{await assert.rejects(()=>runGuard(p,new FixtureBackend(p)),e=>e.code==='EEXIST');assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'NORMAL');}
  finally{await cleanup(p);}
});
test('absolute stop timer cancels a slow pending read and restores on time',async()=>{
  const p=setup('slow-snapshot',{slowSnapshotAt:8,snapshotDelayMs:3000});p.operationMs=4000;
  try{
    const r=await runGuard(p,new FixtureBackend(p));
    assert.equal(r.status,'PASS');assert.equal(r.normalRestored,true);assert.equal(r.withinDeadline,true);
    const events=fs.readFileSync(path.join(p.receiptDirectory,'journal.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    const timer=events.find(e=>e.type==='AUTOMATIC_STOP_TIMER'),quit=events.find(e=>e.type==='NORMAL_QUIT_REQUESTED');
    assert.ok(timer&&quit);assert.ok(timer.elapsedMs<=p.observeMs+250);assert.ok(quit.elapsedMs<=p.observeMs+350);
  }finally{await cleanup(p);}
});
test('timed out apply is cancelled before restore and cannot write later',async()=>{
  const p=setup('late-write',{applyDelayMs:2500});
  try{
    const r=await runGuard(p,new FixtureBackend(p));assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,true);
    assert.match(r.failure,/OPERATION_TIMEOUT/);await delay(2750);
    assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'NORMAL');assert.equal(fs.existsSync(path.join(p.fixtureRoot,'processes.json')),false);
  }finally{await cleanup(p);}
});
test('timed out launch is cancelled and cannot start after normal restoration',async()=>{
  const p=setup('late-launch',{launchDelayMs:2500});
  try{
    const r=await runGuard(p,new FixtureBackend(p));assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,true);
    assert.equal(r.runBound,false);await delay(2750);
    assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'NORMAL');assert.equal(fs.existsSync(path.join(p.fixtureRoot,'processes.json')),false);
  }finally{await cleanup(p);}
});
test('apply commit with failed receipt still enters reconciliation',async()=>run('commit-receipt-error',{commitReceiptFailure:true},(r,p)=>{
  assert.equal(r.status,'FAIL');assert.equal(r.diagnosticApplied,false);assert.equal(r.normalRestored,true);assert.match(r.failure,/COMMITTED_RECEIPT_FAILURE/);
  assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'NORMAL');
}));
test('unknown target bytes cannot arm or apply',async()=>{
  const p=setup('unknown-bytes',{});fs.writeFileSync(path.join(p.fixtureRoot,'target'),'UNKNOWN');
  try{const r=await runGuard(p,new FixtureBackend(p));assert.equal(r.status,'FAIL');assert.equal(r.armed,false);assert.equal(r.diagnosticApplied,false);}
  finally{await cleanup(p);}
});
test('backend pins its declared dependencies before apply and restoration',async()=>{
  const p=setup('dependencies',{requireDependencies:true}),file=path.join(p.fixtureRoot,'dependency.mjs');fs.writeFileSync(file,'export {};\n');
  p.pinnedDependencies=[{path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}];
  const b=new FixtureBackend(p),normal=b.normalQuit.bind(b);b.normalQuit=async()=>{fs.appendFileSync(file,'// changed\n');await normal();};
  try{const r=await runGuard(p,b);assert.equal(r.runBound,true);assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,false);assert.match(r.failure,/DEPENDENCY_PIN/);}
  finally{await cleanup(p);}
});
test('backend rejects a hard-linked declared dependency',async()=>{
  const p=setup('hardlink',{requireDependencies:true}),file=path.join(p.fixtureRoot,'dependency.mjs');fs.writeFileSync(file,'export {};\n');fs.linkSync(file,path.join(p.fixtureRoot,'alias.mjs'));
  p.pinnedDependencies=[{path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}];
  try{const r=await runGuard(p,new FixtureBackend(p));assert.equal(r.status,'FAIL');assert.equal(r.armed,false);assert.match(r.failure,/FILE_BOUNDARY/);}
  finally{fs.unlinkSync(path.join(p.fixtureRoot,'alias.mjs'));await cleanup(p);}
});
test('backend refuses a missing dependency declaration when required',async()=>{
  const p=setup('missing-dependencies',{requireDependencies:true});
  try{const r=await runGuard(p,new FixtureBackend(p));assert.equal(r.status,'FAIL');assert.equal(r.armed,false);assert.match(r.failure,/DEPENDENCY_PLAN/);}
  finally{await cleanup(p);}
});
test('main ParentPID change is rejected even when runId and PID stay unchanged',async()=>run('parent-change',{changeParent:true},r=>{
  assert.equal(r.status,'FAIL');assert.equal(r.quitAttempted,false);assert.equal(r.normalRestored,false);assert.match(r.failure,/FOREIGN_PROCESS/);
}));
test('journal failure cannot prevent the independent timer from stopping and restoring',async()=>{
  const p=setup('journal-failure',{slowSnapshotAt:8,snapshotDelayMs:3000});p.operationMs=4000;
  const io={...fs,writeSync(fd,data,...args){if(String(data).includes('AUTOMATIC_STOP_TIMER'))throw new Error('OWNED_FIXTURE_JOURNAL_FAIL');return fs.writeSync(fd,data,...args);}};
  try{const r=await runGuard(p,new FixtureBackend(p),io);assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,true);assert.equal(r.withinDeadline,true);assert.equal(r.journalFailure,true);assert.match(r.failure,/JOURNAL_IO_FAILURE/);}
  finally{await cleanup(p);}
});
test('cancelled backend generation cannot perform a delayed launch',async()=>{
  const p=setup('cancelled-generation',{launchDelayMs:100}),b=new FixtureBackend(p);
  const attempt=b.launchDiagnostic();const observed=assert.rejects(()=>attempt,{code:'OWNED_OPERATION_CANCELLED'});await b.cancelOwnedOperations();
  try{await observed;await delay(150);assert.equal(fs.existsSync(path.join(p.fixtureRoot,'launch.json')),false);}
  finally{await cleanup(p);}
});
test('main clean exit with Host still alive prevents restoration',async()=>run('host-remains',{hostRemains:true},(r,p)=>{
  assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,false);assert.equal(r.quitAttempted,true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(p.fixtureRoot,'active-run.json'))).clean,true);
  assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'DIAGNOSTIC');
}));
test('unconfirmed helper cancellation prevents quit, restore, and restart',async()=>{
  const p=setup('cancel-unconfirmed',{}),b=new FixtureBackend(p);
  b.cancelOwnedOperations=async()=>{throw Object.assign(new Error('OWNED_OPERATION_EXIT_UNCONFIRMED'),{code:'OWNED_OPERATION_EXIT_UNCONFIRMED'});};
  try{const r=await runGuard(p,b);assert.equal(r.status,'FAIL');assert.equal(r.quitAttempted,false);assert.equal(r.normalRestored,false);assert.match(r.failure,/OWNED_OPERATION_EXIT_UNCONFIRMED/);}
  finally{await cleanup(p);}
});
test('final receipt conflict reports FAIL after safely restoring',async()=>{
  const p=setup('receipt-conflict',{});fs.writeFileSync(path.join(p.receiptDirectory,'result.json'),'prior-owner-receipt');
  try{const r=await runGuard(p,new FixtureBackend(p));assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,true);assert.match(r.failure,/FINAL_RECEIPT_FAILURE/);assert.equal(fs.readFileSync(path.join(p.receiptDirectory,'result.json'),'utf8'),'prior-owner-receipt');}
  finally{await cleanup(p);}
});
test('actual ended schema disproves the old started predicate and recovers with the bound identity',async()=>{
  const p=setup('actual-ended-regression',{schemaValidation:true}),b=new FixtureBackend(p);
  try{
    const r=await runGuard(p,b),ended=JSON.parse(fs.readFileSync(path.join(p.fixtureRoot,'active-run.json')));
    assert.equal(r.status,'PASS');assert.equal(r.normalRestored,true);assert.equal(ended.clean,true);assert.ok(!Object.hasOwn(ended,'started'));
    const legacyIdentity=(run,expected)=>run.runId===expected.runId&&run.pid===expected.pid&&run.started===expected.started;
    assert.equal(typeof b.observedActiveRun.started,'string');assert.equal(legacyIdentity(ended,b.observedActiveRun),false);
  }finally{await cleanup(p);}
});
for(const variant of ['changed-id','changed-pid','invalid-ended','future-ended','before-start','missing-ended','changed-start']){
  test('clean-ended rejects '+variant,async()=>run('ended-'+variant,{endedVariant:variant,schemaValidation:true},(r,p)=>{
    assert.equal(r.diagnosticApplied,true);assert.equal(r.runBound,true);assert.equal(r.quitAttempted,true);
    assert.equal(r.status,'FAIL');assert.equal(r.normalRestored,false);assert.match(r.failure,/RUN_IDENTITY_CHANGED/);
    assert.equal(fs.readFileSync(path.join(p.fixtureRoot,'target'),'utf8'),'DIAGNOSTIC');
  }));
}

const directoryBytes=root=>{
  const rows=[];const walk=(dir,p='')=>{for(const name of fs.readdirSync(dir).sort()){
    const file=path.join(dir,name),key=p?p+'/'+name:name,st=fs.lstatSync(file);assert.equal(st.isSymbolicLink(),false);
    if(st.isDirectory())walk(file,key);else rows.push({file:key,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
  }};walk(root);return rows;
};
async function junctionCounterexample(afterMarker){
  const p=setup('cleanup-root-junction',{}),foreign=setup('cleanup-foreign-owned',{}),original=p.fixtureRoot,backup=original+'-saved';
  const identity=fs.lstatSync(original,{bigint:true}),foreignMarker=path.join(foreign.fixtureRoot,'fixture-owner.json'),foreignBytes=fs.readFileSync(foreignMarker);
  assert.equal(path.dirname(original),fs.realpathSync(path.dirname(original)));assert.ok(path.basename(original).startsWith('diagnostic-deadline-fixture-'));assert.equal(path.dirname(backup),path.dirname(original));assert.equal(fs.existsSync(backup),false);
  fs.writeFileSync(foreignMarker,fs.readFileSync(path.join(original,'fixture-owner.json')));
  const before=directoryBytes(foreign.fixtureRoot);let replaced=false;
  const replace=()=>{fs.renameSync(original,backup);fs.symlinkSync(foreign.fixtureRoot,original,'junction');replaced=true;};
  try{
    if(!afterMarker)replace();
    await assert.rejects(()=>disposeFixture(p,afterMarker?{afterMarkerRead:replace}:{}),{code:'CLEANUP_BOUNDARY'});
    assert.deepEqual(directoryBytes(foreign.fixtureRoot),before);assert.equal(fs.existsSync(path.join(foreign.fixtureRoot,'fixture-cleanup')),false);
  }finally{
    if(replaced){assert.equal(fs.lstatSync(original).isSymbolicLink(),true);assert.equal(fs.realpathSync(original),fs.realpathSync(foreign.fixtureRoot));fs.unlinkSync(original);assert.equal(fs.realpathSync(backup),backup);fs.renameSync(backup,original);const now=fs.lstatSync(original,{bigint:true});assert.equal(now.dev,identity.dev);assert.equal(now.ino,identity.ino);}
    fs.writeFileSync(foreignMarker,foreignBytes);await cleanup(p);await cleanup(foreign);
  }
}
test('cleanup rejects a replaced root junction before reading or writing its target',async()=>junctionCounterexample(false));
test('cleanup rechecks root identity after marker read before command creation',async()=>junctionCounterexample(true));
test('cleanup rejects a hardlinked command without changing the external owned sentinel',async()=>{
  const p=setup('cleanup-hardlink',{}),foreign=setup('cleanup-hardlink-foreign',{}),sentinel=path.join(foreign.fixtureRoot,'sentinel.txt'),link=path.join(p.fixtureRoot,'fixture-cleanup');
  fs.writeFileSync(sentinel,'OWNED_FOREIGN_SENTINEL');fs.linkSync(sentinel,link);const before=directoryBytes(foreign.fixtureRoot);
  try{await assert.rejects(()=>cleanup(p),{code:'CLEANUP_HARDLINK'});assert.deepEqual(directoryBytes(foreign.fixtureRoot),before);assert.equal(fs.existsSync(p.fixtureRoot),true);}
  finally{if(fs.existsSync(link)){assert.equal(fs.lstatSync(link).isFile(),true);fs.unlinkSync(link);}await cleanup(p);await cleanup(foreign);}
});
test('marker replacement after read is rejected, then restored ownership allows normal fixture exit',async()=>{
  const p=setup('cleanup-marker-replacement',{hang:true}),b=new FixtureBackend(p),owner=path.join(p.fixtureRoot,'fixture-owner.json'),saved=owner+'.saved';
  let replaced=false;
  try{
    const launch=await b.launchDiagnostic(),state=await awaitOwnedHostReady(p,b,launch);
    assert.equal(state.run.pid,launch.pid);assert.ok(state.processes.length>=2);
    const ownedPids=state.processes.map(row=>row.pid);
    await assert.rejects(()=>disposeFixture(p,{afterMarkerRead(){const bytes=fs.readFileSync(owner);fs.renameSync(owner,saved);fs.writeFileSync(owner,bytes,{flag:'wx'});replaced=true;}}),{code:'CLEANUP_MARKER_CHANGED'});
    assert.equal(fs.existsSync(path.join(p.fixtureRoot,'fixture-cleanup')),false);assert.ok(ownedPids.every(ownedPidAlive));
  }finally{
    if(replaced){assert.equal(fs.realpathSync(p.fixtureRoot),p.fixtureRoot);assert.equal(fs.lstatSync(owner).isFile(),true);fs.unlinkSync(owner);fs.renameSync(saved,owner);}
    await cleanup(p);assert.equal(fs.existsSync(p.fixtureRoot),false);
  }
});


test('Host exit observed before main finish still completes nonce cleanup',async()=>{
  const p=setup('host-exited-before-finish',{hang:true}),b=new FixtureBackend(p);
  try{
    const launch=await b.launchDiagnostic(),until=Date.now()+3000;let state;
    do{state=await b.snapshot();if(state.run.pid===launch.pid&&state.processes.length>=2)break;await delay(20);}while(Date.now()<until);
    assert.equal(state.run.pid,launch.pid);assert.equal(state.processes.length,2);
    const nonce=JSON.parse(fs.readFileSync(path.join(p.fixtureRoot,'fixture-owner.json'),'utf8')).nonce;
    fs.writeFileSync(path.join(p.fixtureRoot,'host-normal-quit'),nonce);
    const hostUntil=Date.now()+3000;
    do{state=await b.snapshot();if(state.processes.length===1&&state.processes[0].pid===launch.pid)break;await delay(20);}while(Date.now()<hostUntil);
    assert.equal(state.processes.length,1);assert.equal(state.processes[0].pid,launch.pid);
  }finally{await cleanup(p);assert.equal(fs.existsSync(p.fixtureRoot),false);}
});
