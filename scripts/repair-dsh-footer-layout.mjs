import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {planDshFooterArchive,planDshFooterRestore,applyDshFooterArchive,summarizeDshFooterArchive} from './lib/dsh-footer-archive.mjs'
export function parseFooterArgs(args){
 const seen=new Set(),values={};let apply=false
 for(let i=0;i<args.length;i++){
  const flag=args[i];if(!['--asar','--electron-exe','--backup-dir','--restore-receipt','--apply','--dry-run'].includes(flag)||seen.has(flag))throw Object.assign(new Error('FOOTER_USAGE'),{code:'FOOTER_USAGE'});seen.add(flag)
  if(flag==='--apply')apply=true
  else if(flag!=='--dry-run'){const value=args[++i];if(typeof value!=='string'||!path.isAbsolute(value)||value.startsWith('--'))throw Object.assign(new Error('FOOTER_USAGE'),{code:'FOOTER_USAGE'});values[flag]=value}
 }
 if(!values['--asar']||!values['--electron-exe']||(apply||values['--restore-receipt'])&&!values['--backup-dir']||apply&&seen.has('--dry-run')||values['--backup-dir']&&!apply&&!values['--restore-receipt'])throw Object.assign(new Error('FOOTER_USAGE'),{code:'FOOTER_USAGE'})
 return{asar:values['--asar'],electronExe:values['--electron-exe'],backupDir:values['--backup-dir'],receiptFile:values['--restore-receipt'],apply}
}
export async function main(args){try{const o=parseFooterArgs(args),p=o.receiptFile?planDshFooterRestore(o):planDshFooterArchive(o),result=o.apply?await applyDshFooterArchive(p,{backupDir:o.backupDir}):{...summarizeDshFooterArchive(p),dryRun:true};console.log(JSON.stringify(result,null,2));return p.action==='REVIEW_UPDATE'?3:0}catch(error){console.log(JSON.stringify({ok:false,error:error.code??'FOOTER_IO',...error.footer?{transaction:error.footer}:{}},null,2));return error.code==='FOOTER_USAGE'?2:1}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main(process.argv.slice(2))
