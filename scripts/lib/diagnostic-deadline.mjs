// Explicit diagnostic deadline controller. Run in an independent owned process.
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = code => { throw Object.assign(new Error(code), {code}); };

export async function runGuard(plan, backend, journalIO = fs) {
  if (plan.kind !== 'dsh-diagnostic-deadline-v1') fail('PLAN_KIND');
  const now = Date.now();
  if (!Number.isFinite(Date.parse(plan.createdAt)) || !Number.isFinite(Date.parse(plan.validUntil)) || Date.parse(plan.validUntil) <= now ||
      Date.parse(plan.createdAt) > now + 1000 || now - Date.parse(plan.createdAt) > 120000) fail('PLAN_EXPIRED');
  const {maxWallMs, observeMs, pollMs = 200, operationMs = 10000} = plan;
  if (![maxWallMs,observeMs,pollMs,operationMs].every(Number.isSafeInteger) ||
      maxWallMs < 1000 || maxWallMs > 300000 || observeMs < 100 ||
      observeMs > maxWallMs - 500 || pollMs < 10 || pollMs > 1000 || operationMs < 50) fail('PLAN_BUDGET');
  const out = path.resolve(plan.receiptDirectory);
  const st = fs.lstatSync(out);
  if (!st.isDirectory() || st.isSymbolicLink() || fs.realpathSync(out) !== out) fail('STATE_DIRECTORY');
  // A new directory per attempt is required. An old receipt cannot be replayed.
  const journalFd = fs.openSync(path.join(out,'journal.jsonl'), 'wx');
  const started = performance.now(), armedAt = Date.now();
  let armed = false, didApply = false, ownedRun = null, launched = null, restored = false;
  let hardExpired = false, failure = null, stage = 'PREFLIGHT', quitAttempted = false, journalFailure = false;
  let stopping = false, stopTimer = null, recoveryPromise = null;
  const elapsed = () => performance.now() - started;
  const event = (type, data = {}) => {
    try{
      journalIO.writeSync(journalFd, JSON.stringify({at:new Date().toISOString(),elapsedMs:Math.round(elapsed()),type,...data})+'\n');
      journalIO.fsyncSync(journalFd);
    }catch{
      if(!journalFailure)failure=failure?failure+';JOURNAL_IO_FAILURE':'JOURNAL_IO_FAILURE';
      journalFailure=true;
    }
  };
  const deadline = setTimeout(() => { hardExpired = true; event('HARD_DEADLINE'); }, maxWallMs);
  const invoke = async (fn, budget = operationMs) => {
    const left = maxWallMs - elapsed();
    if (left <= 0) fail('HARD_DEADLINE');
    let timer, timedOut = false;
    const operation = Promise.resolve().then(fn);
    try {
      return await new Promise((resolve,reject)=>{
        operation.then(value=>{if(!timedOut)resolve(value);},error=>{if(!timedOut)reject(error);});
        timer=setTimeout(async()=>{
          timedOut=true;
          try{
            await backend.cancelOwnedOperations?.();
            // A cancelled operation must settle before recovery can write.
            let settleTimer;
            try{await Promise.race([operation.catch(()=>{}),new Promise((_,r)=>{
              settleTimer=setTimeout(()=>r(Object.assign(new Error('OWNED_OPERATION_UNSETTLED'),{code:'OWNED_OPERATION_UNSETTLED'})),1500);
            })]);}finally{clearTimeout(settleTimer);}
            reject(Object.assign(new Error('OPERATION_TIMEOUT'),{code:'OPERATION_TIMEOUT'}));
          }catch(e){reject(e);}
        },Math.min(budget,left));
      });
    } finally { clearTimeout(timer); }
  };
  const snapshot = () => invoke(() => backend.snapshot());
  const sameRun = (run, expected) => !!(run && expected && run.runId === expected.runId && run.pid === expected.pid);
  const activeIdentity = (run, expected) => sameRun(run,expected) && run.clean === false && run.started === expected.started;
  const endedMetadata = (run, expected) => {
    if (!sameRun(run,expected) || run.clean !== true || typeof run.ended !== 'string' ||
        (Object.hasOwn(run,'started') && run.started !== expected.started)) return false;
    const endedMs=Date.parse(run.ended),startedMs=Date.parse(expected.started);
    return Number.isFinite(endedMs) && Number.isFinite(startedMs) &&
      new Date(endedMs).toISOString()===run.ended && endedMs>=startedMs && endedMs<=Date.now();
  };
  // Desktop endRun replaces active-run with {runId,pid,ended,clean}; it drops
  // started. Only already-bound runs with a valid terminal time and no remaining
  // same-executable processes may use that terminal identity for restoration.
  const identity = (s, expected) => activeIdentity(s.run,expected) ||
    (endedMetadata(s.run,expected) && s.processes.length===0);
  const ownedProcesses = new Map();
  const verifyOwned = s => {
    if (!activeIdentity(s.run,ownedRun) && !endedMetadata(s.run,ownedRun)) fail('RUN_IDENTITY_CHANGED');
    // Preserve observed child identities after their parents exit. A fresh,
    // unrelated same-executable process does not become ours by being recent.
    const pending = [...s.processes];
    for (let round = 0; pending.length && round <= s.processes.length; round++) {
      for (let i = pending.length-1; i >= 0; i--) {
        const p = pending[i], previous = ownedProcesses.get(p.pid);
        if (p.startedMs < armedAt - 1000 || (previous && (previous.startedMs !== p.startedMs || previous.parentPid !== p.parentPid))) fail('FOREIGN_PROCESS');
        const root = p.pid === ownedRun.pid;
        if (root && !previous && (!launched || p.parentPid!==launched.parentPid || p.startedMs<launched.notBeforeMs-1000 || p.startedMs>launched.notAfterMs)) fail('MAIN_PROCESS_IDENTITY');
        if (root || previous || ownedProcesses.has(p.parentPid)) {
          ownedProcesses.set(p.pid,{startedMs:p.startedMs,parentPid:p.parentPid}); pending.splice(i,1);
        }
      }
    }
    if (pending.length) fail('FOREIGN_PROCESS');
  };
  const recover = () => recoveryPromise ||= (async () => {
    stopping = true;
    try {
      if (armed) {
        await backend.cancelOwnedOperations?.();
        stage = 'STOP';
        let s = await snapshot();
        if (!ownedRun && launched && s.run?.pid === launched.pid && Date.parse(s.run.started) >= armedAt - 1000) {
          ownedRun = {runId:s.run.runId,pid:s.run.pid,started:s.run.started};
        }
        if (s.processes.length) {
          if (!ownedRun) fail('UNBOUND_RUNTIME_NO_QUIT');
          verifyOwned(s);
          quitAttempted = true;
          event('NORMAL_QUIT_REQUESTED');
          await invoke(() => backend.normalQuit(), Math.min(operationMs,maxWallMs-elapsed()));
        }
        while (s.processes.length && elapsed() < maxWallMs) {
          await delay(Math.min(pollMs,Math.max(1,maxWallMs-elapsed())));
          s = await snapshot();
          verifyOwned(s);
        }
        if (s.processes.length) fail('EXIT_UNCONFIRMED');
        if (ownedRun && !identity(s,ownedRun)) fail('RUN_IDENTITY_CHANGED');
        if (s.run?.clean !== true) fail('SHUTDOWN_NOT_CLEAN');
        event('ALL_PROCESSES_EXITED');
        stage = 'RESTORE';
        // Includes uncertain apply: backend reconciles exact hash + receipt.
        await invoke(() => backend.restore());
        restored = true;
        event('NORMAL_RESTORED');
      }
    } catch (e) {
      const code = e.code || 'RECOVERY_ERROR';
      failure = failure ? failure+';'+code : code;
      event('RECOVERY_FAILED',{stage,code});
    }
  })();
  const notStopping = () => {if(stopping || elapsed()>=observeMs) fail('OBSERVATION_DEADLINE');};
  try {
    await invoke(() => backend.preflight());
    const before = await snapshot();
    if (before.processes.length || before.run?.clean !== true) fail('EXISTING_OR_UNCLEAN_RUNTIME');
    notStopping();
    event('ARMED', {maxWallMs,observeMs,reserveMs:maxWallMs-observeMs});
    armed = true;
    // Independent of the coordinator and of pending read/operation promises.
    stopTimer = setTimeout(() => {
      event('AUTOMATIC_STOP_TIMER');
      void recover();
    }, Math.max(1,observeMs-elapsed()));
    stage = 'APPLY';
    // backend owns bounded child processes; it must not return a timed-out child
    // that can later modify the target. It must reconcile uncertain commits.
    await invoke(() => backend.apply(), Math.min(operationMs,observeMs/2));
    didApply = true;
    event('DIAGNOSTIC_APPLIED');
    notStopping();
    stage = 'START';
    launched = await invoke(() => backend.launchDiagnostic());
    notStopping();
    while (!stopping && elapsed() < observeMs) {
      const s = await snapshot();
      if (s.run && s.run.pid === launched.pid && Date.parse(s.run.started) >= armedAt - 1000 && s.run.clean === false) {
        ownedRun = {runId:s.run.runId,pid:s.run.pid,started:s.run.started};
        verifyOwned(s);
        event('BOUND', {pid:ownedRun.pid});
        break;
      }
      if (s.processes.some(p => p.pid !== launched.pid && p.startedMs < armedAt - 1000)) fail('FOREIGN_PROCESS');
      await delay(Math.min(pollMs,Math.max(1,observeMs-elapsed())));
    }
    if (!ownedRun) fail('START_NOT_CONFIRMED');
    stage = 'OBSERVE';
    while (!stopping && elapsed() < observeMs) {
      const s = await snapshot();
      verifyOwned(s);
      if (!s.processes.length) { event('EARLY_EXIT'); break; }
      await delay(Math.min(pollMs,Math.max(1,observeMs-elapsed())));
    }
    event('OBSERVATION_ENDED');
  } catch (e) {
    if (stopping && ownedRun && ['HELPER_EXIT','OWNED_OPERATION_CANCELLED'].includes(e.code)) {
      event('PENDING_READ_CANCELLED_FOR_STOP');
    } else {
      failure = e.code || 'CONTROLLER_ERROR';
      event('FAILURE',{stage,code:failure});
    }
  }

  clearTimeout(stopTimer);
  await recover();
  clearTimeout(deadline);
  const completedMs = Math.round(elapsed());
  const withinDeadline = !hardExpired && completedMs <= maxWallMs;
  const result = {
    kind:plan.kind,status:!failure && restored && withinDeadline?'PASS':'FAIL',
    armed,diagnosticApplied:didApply,runBound:!!ownedRun,quitAttempted,
    normalRestored:restored,withinDeadline,maxWallMs,elapsedMs:completedMs,
    failure,hardExpired,journalFailure,forceKillDsh:false,coordinatorRequiredAfterArm:false
  };
  event('RECOVERY_COMPLETE',{normalRestored:restored,withinDeadline,elapsedMs:completedMs,failure});
  if(journalFailure){result.status='FAIL';result.journalFailure=true;result.failure=failure;}
  try{fs.closeSync(journalFd);}catch{result.status='FAIL';result.failure=(result.failure?result.failure+';':'')+'JOURNAL_CLOSE_FAILURE';}
  try{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
  catch{result.status='FAIL';result.failure=(result.failure?result.failure+';':'')+'FINAL_RECEIPT_FAILURE';}
  return result;
}
