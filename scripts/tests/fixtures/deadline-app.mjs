// Named, temporary test processes only. No production application is controlled.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [root,mode,nonce]=process.argv.slice(2),file=name=>path.join(root,name);
const marker=JSON.parse(fs.readFileSync(file('fixture-owner.json'),'utf8'));
if(marker.kind!=='diagnostic-deadline-fixture'||marker.nonce!==nonce)throw new Error('FIXTURE_IDENTITY');
const requested=name=>{try{return fs.readFileSync(file(name),'utf8')===nonce;}catch{return false;}};
if(mode==='host'){
  // PID existence precedes module startup; publish only after the owner read.
  fs.writeFileSync(file('host-ready.json'),JSON.stringify({nonce,pid:process.pid,parentPid:process.ppid,readyAt:Date.now()}),{flag:'wx'});
  const timer=setInterval(()=>{if(requested('fixture-cleanup')||requested('host-normal-quit')){clearInterval(timer);process.exit(0);}},15);
  setTimeout(()=>process.exit(2),90000).unref();
}else{
  const options=JSON.parse(fs.readFileSync(file('options.json'),'utf8'));
  const publish=run=>{
    const tmp=file('run.tmp');fs.writeFileSync(tmp,JSON.stringify(run));
    for(let attempt=0;;attempt++)try{fs.renameSync(tmp,file('active-run.json'));return;}
    catch(e){if(attempt>=5||!['EPERM','EBUSY','EACCES'].includes(e.code))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3);}
  };
  const startedMs=Date.now(),run={runId:nonce,pid:process.pid,started:new Date(startedMs).toISOString(),clean:false};
  const host=spawn(process.execPath,[fileURLToPath(import.meta.url),root,'host',nonce],{detached:true,stdio:'ignore',windowsHide:true});
  // Capture child exit immediately; cleanup may be observed by Host first.
  const hostExited=new Promise(resolve=>{
    if(host.exitCode!==null||host.signalCode!==null)resolve();else host.once('exit',resolve);
  });
  host.unref();
  const rows=[{pid:process.pid,parentPid:process.ppid,startedMs},{pid:host.pid,parentPid:process.pid,startedMs:Date.now()}];
  fs.writeFileSync(file('processes.json'),JSON.stringify({nonce,rows}));
  setTimeout(()=>publish(run),options.startDelayMs||0);
  const ended=()=>{
    const record={runId:run.runId,pid:run.pid,ended:new Date().toISOString(),clean:!options.unclean};
    if(options.endedVariant==='changed-id')record.runId='foreign-fixture';
    if(options.endedVariant==='changed-pid')record.pid++;
    if(options.endedVariant==='invalid-ended')record.ended='INVALID';
    if(options.endedVariant==='future-ended')record.ended=new Date(Date.now()+60000).toISOString();
    if(options.endedVariant==='before-start')record.ended=new Date(Date.parse(run.started)-1000).toISOString();
    if(options.endedVariant==='missing-ended')delete record.ended;
    if(options.endedVariant==='changed-start')record.started=new Date(Date.parse(run.started)-1).toISOString();
    publish(record);
  };
  let closing=false,identityChanged=false,parentChanged=false;
  const finish=cleanup=>{
    if(closing)return;closing=true;
    if(!cleanup&&options.hostRemains){ended();process.exit(0);}
    hostExited.then(()=>{clearInterval(timer);if(!cleanup)ended();process.exit(0);});
    fs.writeFileSync(file(cleanup?'fixture-cleanup':'host-normal-quit'),nonce);
  };
  const timer=setInterval(()=>{
    if(requested('fixture-cleanup')){finish(true);return;}
    if(options.changeParent&&!parentChanged&&Date.now()-startedMs>300){parentChanged=true;rows[0].parentPid=0;fs.writeFileSync(file('processes.json'),JSON.stringify({nonce,rows}));}
    if(options.changeIdentity&&!identityChanged&&Date.now()-startedMs>300){identityChanged=true;run.runId='foreign-fixture';publish(run);}
    if(!options.hang&&!closing&&requested('quit')){fs.writeFileSync(file('quit-observed'),'normal-command');setTimeout(()=>finish(false),options.closeDelayMs||30);}
  },15);
  setTimeout(()=>finish(true),85000).unref();
}
