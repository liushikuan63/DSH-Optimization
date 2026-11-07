// Optional, explicit, dry-run by default. No target-code imports or DSH actions.
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {planBiliStatusCors,applyBiliStatusCors,planBiliStatusCorsRestore,applyBiliStatusCorsRestore,summarizeBiliStatusCors} from './lib/bili-status-cors.mjs'
export function parseBiliCorsArgs(args){
 const seen=new Set();let bundleRoot,backupDir,restoreReceipt,apply=false
 for(let i=0;i<args.length;i++){
  const arg=args[i]
  if(!['--bundle-root','--backup-dir','--restore-receipt','--apply','--dry-run'].includes(arg)||seen.has(arg))throw Object.assign(new Error('BILI_CORS_USAGE'),{code:'BILI_CORS_USAGE'})
  seen.add(arg)
  if(arg==='--bundle-root'||arg==='--backup-dir'||arg==='--restore-receipt'){
   const value=args[++i];if(typeof value!=='string'||!path.isAbsolute(value)||value.startsWith('--'))throw Object.assign(new Error('BILI_CORS_USAGE'),{code:'BILI_CORS_USAGE'})
   if(arg==='--bundle-root')bundleRoot=value;else if(arg==='--backup-dir')backupDir=value;else restoreReceipt=value
  }
  if(arg==='--apply')apply=true
 }
 if(!bundleRoot||(apply||restoreReceipt)&&!backupDir||seen.has('--apply')&&seen.has('--dry-run')||backupDir&&!apply&&!restoreReceipt)throw Object.assign(new Error('BILI_CORS_USAGE'),{code:'BILI_CORS_USAGE'})
 return{bundleRoot,backupDir,restoreReceipt,apply}
}
export async function main(args){
 try{
  const options=parseBiliCorsArgs(args),plan=options.restoreReceipt?planBiliStatusCorsRestore(options.bundleRoot,{receiptFile:options.restoreReceipt,backupDir:options.backupDir}):planBiliStatusCors(options.bundleRoot),result=options.apply?(options.restoreReceipt?await applyBiliStatusCorsRestore(plan):await applyBiliStatusCors(plan,{backupDir:options.backupDir})):{...summarizeBiliStatusCors(plan),dryRun:true}
  console.log(JSON.stringify(result,null,2));return plan.action==='REVIEW_UPDATE'?3:0
 }catch(error){console.log(JSON.stringify({ok:false,error:error.code??'BILI_CORS_IO',...error.biliCors?{transaction:error.biliCors}:{}},null,2));return error.code==='BILI_CORS_USAGE'?2:1}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main(process.argv.slice(2))
