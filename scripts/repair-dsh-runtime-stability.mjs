import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {planDshRuntimeStability,planDshRuntimeRestore,applyDshRuntimeStability,summarizeDshRuntimeStability} from './lib/dsh-runtime-stability.mjs'
export function parseRuntimeStabilityArgs(args){
 const seen=new Set(),values={};let apply=false
 for(let i=0;i<args.length;i++){
  const flag=args[i];if(!['--asar','--electron-exe','--backup-dir','--restore-receipt','--apply','--dry-run'].includes(flag)||seen.has(flag))throw Object.assign(new Error('RUNTIME_STABILITY_USAGE'),{code:'RUNTIME_STABILITY_USAGE'});seen.add(flag)
  if(flag==='--apply')apply=true
  else if(flag!=='--dry-run'){const value=args[++i];if(typeof value!=='string'||!path.isAbsolute(value)||value.startsWith('--'))throw Object.assign(new Error('RUNTIME_STABILITY_USAGE'),{code:'RUNTIME_STABILITY_USAGE'});values[flag]=value}
 }
 if(!values['--asar']||!values['--electron-exe']||(apply||values['--restore-receipt'])&&!values['--backup-dir']||apply&&seen.has('--dry-run')||values['--backup-dir']&&!apply&&!values['--restore-receipt'])throw Object.assign(new Error('RUNTIME_STABILITY_USAGE'),{code:'RUNTIME_STABILITY_USAGE'})
 return{asar:values['--asar'],electronExe:values['--electron-exe'],backupDir:values['--backup-dir'],receiptFile:values['--restore-receipt'],apply}
}
export function runtimeResultExitCode(plan,result){return result.cleanupComplete===false?4:plan.action==='REVIEW_UPDATE'?3:0}
export async function main(args){try{const o=parseRuntimeStabilityArgs(args),p=o.receiptFile?planDshRuntimeRestore(o):planDshRuntimeStability(o),result=o.apply?await applyDshRuntimeStability(p,{backupDir:o.backupDir}):{...summarizeDshRuntimeStability(p),dryRun:true};console.log(JSON.stringify(result,null,2));return runtimeResultExitCode(p,result)}catch(error){console.log(JSON.stringify({ok:false,error:error.code??'RUNTIME_STABILITY_IO',...error.processCheckReason?{processCheckReason:error.processCheckReason}:{},...error.processCheckCleanup?{processCheckCleanup:error.processCheckCleanup}:{},...error.runtimePhase?{runtimePhase:error.runtimePhase}:{},...error.runtimeStability?{transaction:error.runtimeStability}:{}},null,2));return error.code==='RUNTIME_STABILITY_USAGE'?2:['RUNTIME_STABILITY_PROCESS_CHECK_PREREQ','RUNTIME_STABILITY_APP_RUNNING'].includes(error.code)?4:1}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main(process.argv.slice(2))
