// Synchronous, journalled publication of a small set of derived files.
// Publication is exclusive per pathname, not an OS atomic multi-file commit.
// Rollback withdraws a public name into our same-volume stage before checking
// ownership and deleting; it never check-then-unlinks a public pathname.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
const fail=code=>Object.assign(new Error('METADATA_'+code),{code:'METADATA_'+code})
const same=(a,b)=>a===null?b===null:b!==null&&a.dev===b.dev&&a.ino===b.ino&&a.hash===b.hash&&a.bytes===b.bytes
const identity=info=>({dev:String(info.dev),ino:String(info.ino)})
const nameOf=value=>{
  if(typeof value!=='string'||!value||value.length>128||!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)||value.endsWith('.')||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value))throw fail('OUTPUT_NAME')
  return value
}
function snapshot(file,{internal=false}={}){
  let named
  try{named=fs.lstatSync(file,{bigint:true})}catch(error){if(error.code==='ENOENT')return null;throw error}
  if(!named.isFile()||named.isSymbolicLink()||(!internal&&named.nlink!==1n))throw fail('FOREIGN_TARGET')
  const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0))
  try{
    const opened=fs.fstatSync(fd,{bigint:true}),bytes=fs.readFileSync(fd),after=fs.fstatSync(fd,{bigint:true}),last=fs.lstatSync(file,{bigint:true})
    if(!opened.isFile()||opened.dev!==named.dev||opened.ino!==named.ino||after.dev!==last.dev||after.ino!==last.ino||after.size!==opened.size||after.mtimeNs!==opened.mtimeNs||after.ctimeNs!==opened.ctimeNs||BigInt(bytes.length)!==after.size)throw fail('CONFLICT')
    return {...identity(after),bytes:bytes.length,hash:digest(bytes),data:bytes}
  }finally{fs.closeSync(fd)}
}
const signature=value=>value===null?null:(({data,...rest})=>rest)(value)
export function captureMetadataPreimages(output,names){
  return names.map(name=>({name:nameOf(name),before:signature(snapshot(path.join(output,name)))}))
}
function boundary(operation,verify){
  // Retry only a bounded Windows sharing/access boundary (at most 5 seconds), with fresh ownership
  // checks before every attempt. Foreign/invalid/EEXIST/ENOENT are not retried.
  const delays=[50,100,200,400,800,1600,1850]
  for(let attempt=0;;attempt++){
    verify?.()
    try{return operation()}catch(error){
      if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=delays.length)throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,delays[attempt])
    }
  }
}

export function publishMetadataPair(output,outputs,{additionalOutputs=[],preimages,onPhase=()=>{}}={}){
  if(typeof output!=='string'||!path.isAbsolute(output)||!Array.isArray(outputs)||!Array.isArray(additionalOutputs)||typeof onPhase!=='function')throw fail('INPUT')
  const payloads=[...outputs,...additionalOutputs].map(({name,bytes})=>({name:nameOf(name),bytes:Buffer.isBuffer(bytes)?Buffer.from(bytes):typeof bytes==='string'?Buffer.from(bytes):(()=>{throw fail('INPUT')})()}))
  if(payloads.length<1||new Set(payloads.map(x=>x.name.toLowerCase())).size!==payloads.length)throw fail('OUTPUT_NAMES')
  // Capture preimages before touching any output, and compare a caller's
  // earlier read-only plan if supplied (e.g. before a tier migration moves).
  const rows=payloads.map((p,index)=>({...p,index,before:snapshot(path.join(output,p.name)),previous:null,published:null}))
  if(preimages!==undefined){
    if(!Array.isArray(preimages)||preimages.length!==rows.length)throw fail('PREIMAGES')
    for(const row of rows){const prior=preimages.find(p=>p.name===row.name);if(!prior||!same(prior.before,signature(row.before)))throw fail('CONFLICT')}
  }
  if(fs.existsSync(output))for(const name of fs.readdirSync(output)){
    if(!name.startsWith('.skills-index-txn-'))continue
    const pending=path.join(output,name),info=fs.lstatSync(pending)
    if(!info.isDirectory()||info.isSymbolicLink())throw fail('PENDING_RECOVERY')
    let record
    try{record=JSON.parse(snapshot(path.join(pending,'journal.json')).data.toString('utf8'))}catch{throw fail('PENDING_RECOVERY')}
    if(record.kind!=='dsh-derived-metadata'||record.output!==fs.realpathSync(output)||record.status!=='rolled-back')throw fail('PENDING_RECOVERY')
  }
  fs.mkdirSync(output,{recursive:true})
  const root=fs.realpathSync(output),rootOwner=fs.lstatSync(root,{bigint:true})
  if(!rootOwner.isDirectory()||rootOwner.isSymbolicLink())throw fail('OUTPUT_DIRECTORY')
  const guard=()=>{const now=fs.lstatSync(output,{bigint:true});if(!now.isDirectory()||now.isSymbolicLink()||now.dev!==rootOwner.dev||now.ino!==rootOwner.ino||fs.realpathSync(output)!==root)throw fail('DIRECTORY_CONFLICT')}
  const lock=path.join(output,'.skills-index.lock')
  let stage,lockOwner,committed=false,journal,lockRemoved=false
  const owned=new Map()
  const phase=(phase,row)=>{guard();onPhase({phase,index:row?.index,name:row?.name,stage,output})}
  function remember(file){const s=snapshot(file,{internal:true});owned.set(file,s);return s}
  function writePrivate(file,bytes){
    const fd=boundary(()=>fs.openSync(file,'wx',0o600),guard)
    try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    return remember(file)
  }
  function writeJournal(status,error){
    journal.status=status;journal.committed=committed;journal.updatedAt=new Date().toISOString()
    if(error)journal.error=String(error.code??error.message)
    journal.lock={name:'.skills-index.lock',owner:signature(lockOwner)}
    journal.files=rows.map(({name,before,previous,published,index})=>({name,index,before:signature(before),previous,published:signature(published),backup:before?'backup-'+index:null,backupOwner:before?signature(owned.get(path.join(stage,'backup-'+index))??null):null}))
    const bytes=Buffer.from(JSON.stringify(journal,null,2)+'\n'),file=path.join(stage,'journal.json')
    // The stage is exclusively created and never accepted from input. Journal
    // rewrites are private; an unknown replacement is retained and refused.
    if(owned.has(file)&&!same(snapshot(file,{internal:true}),owned.get(file)))throw fail('JOURNAL_CONFLICT')
    fs.writeFileSync(file,bytes,{flag:owned.has(file)?'w':'wx',mode:0o600});remember(file)
  }
  function deletePrivate(file,expected){
    boundary(()=>fs.unlinkSync(file),()=>{guard();if(!same(snapshot(file,{internal:true}),expected))throw fail('STAGE_CONFLICT')})
    owned.delete(file)
  }
  function restoreExclusive(from,target,expected){
    boundary(()=>fs.linkSync(from,target),()=>{guard();if(!same(snapshot(from,{internal:true}),expected))throw fail('STAGE_CONFLICT')})
    // linkSync is exclusive: an existing concurrent target is never replaced.
    deletePrivate(from,expected)
  }
  function withdraw(target,to,expected,row,rollback=false){
    if(!rollback&&!same(snapshot(target),expected))throw fail('CONFLICT')
    phase(rollback?'rollback-before-withdraw':'before-withdraw',row)
    boundary(()=>fs.renameSync(target,to),()=>{guard();if(!rollback&&!same(snapshot(target),expected))throw fail('CONFLICT')})
    const actual=remember(to)
    phase(rollback?'rollback-after-withdraw':'after-withdraw',row)
    if(!same(actual,expected)){
      try{restoreExclusive(to,target,actual)}catch{/* keep the foreign object in the journalled stage */}
      throw fail('RECOVERY_REQUIRED')
    }
    return actual
  }
  function releaseLock(){
    if(!lockOwner)return
    const withdrawn=path.join(stage,'released-lock')
    withdraw(lock,withdrawn,lockOwner,null,true)
    deletePrivate(withdrawn,lockOwner);lockRemoved=true
  }
  function rollback(){
    let incomplete=false
    for(const row of [...rows].reverse()){
      const target=path.join(output,row.name)
      try{
        if(row.published){
          let present
          try{present=snapshot(target)}catch{incomplete=true;continue}
          if(present){const held=path.join(stage,'revoke-'+row.index);withdraw(target,held,row.published,row,true);deletePrivate(held,row.published)}
        }
        if(row.previous){
          const source=path.join(stage,row.previous)
          const previous=snapshot(source,{internal:true})
          // A planned withdrawal can fail before rename. Do not mistake the
          // untouched current path for a failed restore in that case.
          if(previous===null){if(snapshot(target)===null)incomplete=true;row.previous=null;continue}
          if(!same(previous,row.before)){incomplete=true;continue}
          if(snapshot(target)!==null){incomplete=true;continue}
          restoreExclusive(source,target,row.before);row.previous=null
        }
      }catch{incomplete=true}
    }
    return !incomplete
  }
  try{
    const fd=boundary(()=>fs.openSync(lock,'wx',0o600),guard)
    try{fs.writeFileSync(fd,JSON.stringify({schemaVersion:1,pid:process.pid,nonce:crypto.randomUUID()}));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    lockOwner=snapshot(lock)
    stage=fs.mkdtempSync(path.join(output,'.skills-index-txn-'))
    const stageOwner=fs.lstatSync(stage,{bigint:true})
    if(stageOwner.dev!==rootOwner.dev)throw fail('STAGE_VOLUME')
    journal={schemaVersion:1,kind:'dsh-derived-metadata',output:root,pid:process.pid,stage:path.basename(stage),createdAt:new Date().toISOString()}
    for(const row of rows){
      if(row.before)writePrivate(path.join(stage,'backup-'+row.index),row.before.data)
      row.next=writePrivate(path.join(stage,'next-'+row.index),row.bytes)
    }
    writeJournal('prepared');phase('prepared')
    for(const row of rows)if(!same(snapshot(path.join(output,row.name)),row.before))throw fail('CONFLICT')
    for(const row of rows){
      const target=path.join(output,row.name)
      if(row.before){row.previous='previous-'+row.index;writeJournal('withdrawing');withdraw(target,path.join(stage,row.previous),row.before,row)}
      row.published=row.next;writeJournal('publishing');phase('before-publish',row)
      try{boundary(()=>fs.linkSync(path.join(stage,'next-'+row.index),target),()=>{guard();if(snapshot(target)!==null)throw fail('CONFLICT')})}
      catch(error){row.published=null;if(error.code==='EEXIST')throw fail('CONFLICT');throw error}
      deletePrivate(path.join(stage,'next-'+row.index),row.next)
      writeJournal('published-part');phase('after-publish',row)
    }
    phase('before-final-verify')
    for(const row of rows)if(!same(snapshot(path.join(output,row.name)),row.published))throw fail('CONFLICT')
    committed=true;writeJournal('committed');releaseLock()
    const names=fs.readdirSync(stage)
    if(names.some(name=>!owned.has(path.join(stage,name))))throw fail('UNKNOWN_STAGE_FILE')
    for(const [file,expected] of [...owned].filter(([file])=>path.basename(file)!=='journal.json'))deletePrivate(file,expected)
    deletePrivate(path.join(stage,'journal.json'),owned.get(path.join(stage,'journal.json')));fs.rmdirSync(stage)
    return {committed:true,files:rows.map(row=>row.name)}
  }catch(error){
    if(stage){
      const restored=committed?false:rollback()
      try{writeJournal(restored?'rolled-back':'recovery-required',error)}catch{/* preserve any existing journal and all staged objects */}
      if(lockOwner&&!lockRemoved)try{releaseLock()}catch{/* keep lock and journal; no blind stale-lock deletion */}
      if(!restored){const uncertain=fail('RECOVERY_REQUIRED');uncertain.stage=stage;uncertain.committed=committed;uncertain.cause=error;throw uncertain}
      error.stage=stage;throw error
    }
    // A lock acquired just before stage creation failed is intentionally kept;
    // its receipt identifies this attempt. Do not unlink an unverified name.
    throw error
  }
}
