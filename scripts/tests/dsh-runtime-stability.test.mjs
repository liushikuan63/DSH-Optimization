import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {encodeAsarHeader,inspectAsarLayout} from '../lib/dsh-footer-archive.mjs'
import {RUNTIME_PINS,classifyRuntimeArchive,appendRuntimeEntry,validateRuntimeAppend,inspectProcessCheckRecord,runtimeFailureState,cleanupRuntimeProcessCheck,buildRuntimeArchive} from '../lib/dsh-runtime-stability.mjs'
import {runtimeResultExitCode} from '../repair-dsh-runtime-stability.mjs'
const cli=fileURLToPath(new URL('../repair-dsh-runtime-stability.mjs',import.meta.url)),hash=b=>crypto.createHash('sha256').update(b).digest('hex')
function fixture(){const payload=Buffer.from('AAABBBKEEP'),header={files:{one:{size:3,offset:'0'},two:{size:3,offset:'3'},keep:{size:4,offset:'6'},native:{unpacked:true,size:4,integrity:{algorithm:'SHA256',hash:'f'.repeat(64)}}},custom:'keep-root-metadata'};return{bytes:Buffer.concat([encodeAsarHeader(header),payload]),header,payload}}
test('classification accepts only exact supported ASAR, EXE, disabled fuse and single links',()=>{const common={exeHash:RUNTIME_PINS.exe,fuse:'DISABLED',nlink:1,exeNlink:1};for(const archiveHash of [RUNTIME_PINS.original,RUNTIME_PINS.footer,RUNTIME_PINS.previous,RUNTIME_PINS.previousR2])assert.equal(classifyRuntimeArchive({...common,archiveHash}).action,'REPAIR');assert.equal(classifyRuntimeArchive({...common,archiveHash:RUNTIME_PINS.after}).action,'KEEP');for(const extra of [{archiveHash:'0'.repeat(64)},{exeHash:'0'.repeat(64)},{fuse:'ENABLED'},{nlink:2},{exeNlink:2}])assert.equal(classifyRuntimeArchive({...common,archiveHash:RUNTIME_PINS.footer,...extra}).action,'REVIEW_UPDATE')})
test('two entry append preserves full old payload, unrelated/unpacked headers and referenced continuous tail',()=>{const f=fixture(),a=appendRuntimeEntry(f.bytes,'one',Buffer.from('new-one')),b=appendRuntimeEntry(a,'two',Buffer.from('new-two'));assert.equal(validateRuntimeAppend(f.bytes,b,['one','two']).originalPayloadExact,true);const n=inspectAsarLayout(b);assert.deepEqual(n.header.files.keep,f.header.files.keep);assert.deepEqual(n.header.files.native,f.header.files.native);assert.ok(n.payload.subarray(0,f.payload.length).equals(f.payload));assert.equal(n.header.custom,f.header.custom)})
test('append validation rejects unrelated metadata, extra allowed metadata, bad algorithm/blocks, payload edits and tails',()=>{const f=fixture(),good=appendRuntimeEntry(appendRuntimeEntry(f.bytes,'one',Buffer.from('new-one')),'two',Buffer.from('new-two')),p=inspectAsarLayout(good);for(const mutate of [h=>h.custom='changed',h=>h.files.keep.executable=true,h=>h.files.one.executable=true,h=>h.files.one.integrity.algorithm='SHA1',h=>h.files.one.integrity.blocks=['0'.repeat(64)]]){const h=structuredClone(p.header);mutate(h);assert.throws(()=>validateRuntimeAppend(f.bytes,Buffer.concat([encodeAsarHeader(h),p.payload]),['one','two']))}assert.throws(()=>validateRuntimeAppend(f.bytes,Buffer.concat([good,Buffer.from('extra')]),['one','two']));const payload=Buffer.from(p.payload);payload[0]^=1;assert.throws(()=>validateRuntimeAppend(f.bytes,Buffer.concat([encodeAsarHeader(p.header),payload]),['one','two']));assert.throws(()=>validateRuntimeAppend(f.bytes,good,['two','one']))})
test('stopped-process request ack requires exact nonce/PID/id, fresh timestamp and clear known results',()=>{const now=Date.now(),o={nonce:'owned-unit',pid:42,request:3,now},record={schema:1,nonce:o.nonce,writerPid:o.pid,ack:o.request,status:'clear',checkedAt:now,running:0,unknown:0};assert.equal(inspectProcessCheckRecord(record,o),true);for(const mutate of [{nonce:'foreign'},{writerPid:43},{ack:2},{checkedAt:now-1501},{checkedAt:now+251},{status:'unknown',unknown:1},{running:-1}])assert.throws(()=>inspectProcessCheckRecord({...record,...mutate},o),e=>e.code==='RUNTIME_STABILITY_PROCESS_CHECK_PREREQ');assert.throws(()=>inspectProcessCheckRecord({...record,status:'running',running:1},o),e=>e.code==='RUNTIME_STABILITY_APP_RUNNING')})
test('a false helper commit flag after publication started never claims a safe unchanged target',()=>{assert.equal(runtimeFailureState({publishing:false}).committed,false);for(const helperCommitted of [false,undefined]){const out=runtimeFailureState({publishing:true,helperCommitted});assert.equal(out.committed,'unknown');assert.equal(out.targetMayHaveChanged,true);assert.equal(out.recoveryRequired,true)}assert.equal(runtimeFailureState({publishing:true,helperCommitted:true}).committed,true);assert.equal(runtimeFailureState({publishing:true,targetCommitted:true,helperCommitted:false}).committed,true)})
test('owned checker cleanup failures preserve commit metadata and never yield CLI success',async()=>{assert.deepEqual(await cleanupRuntimeProcessCheck(async()=>true),{cleanupComplete:true});for(const close of [async()=>false,async()=>{throw Object.assign(new Error('private fixture message'),{code:'EPERM'})}]){const cleanup=await cleanupRuntimeProcessCheck(close);assert.equal(cleanup.cleanupComplete,false);const result={applied:true,committed:true,receipt:'owned-receipt',...cleanup};assert.equal(runtimeResultExitCode({action:'REPAIR'},result),4);assert.equal(result.committed,true);assert.equal(result.receipt,'owned-receipt')}assert.equal(runtimeResultExitCode({action:'REVIEW_UPDATE'},{}),3)})
test('CLI unknown bytes remain untouched in dry-run and apply; bad flags fail before writes',t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-runtime-unit-'));t.after(()=>{assert.equal(fs.realpathSync(path.dirname(root)),fs.realpathSync(os.tmpdir()));assert.equal(fs.lstatSync(root).isSymbolicLink(),false);assert.match(path.basename(root),/^dsh-runtime-unit-/);fs.rmSync(root,{recursive:true,force:true})});const asar=path.join(root,'app.asar'),exe=path.join(root,'owned.exe'),backup=path.join(root,'backup');fs.mkdirSync(backup);fs.writeFileSync(asar,'unknown asar');fs.writeFileSync(exe,'unknown executable');const original=fs.readFileSync(asar);for(const extra of [[],['--apply','--backup-dir',backup]]){const r=spawnSync(process.execPath,[cli,'--asar',asar,'--electron-exe',exe,...extra],{encoding:'utf8'});assert.equal(r.status,3,r.stderr);assert.equal(JSON.parse(r.stdout).action,'REVIEW_UPDATE');assert.ok(fs.readFileSync(asar).equals(original));assert.deepEqual(fs.readdirSync(backup),[])}for(const extra of [['--apply'],['--unknown'],['--dry-run','--dry-run'],['--apply','--dry-run','--backup-dir',backup]])assert.equal(spawnSync(process.execPath,[cli,'--asar',asar,'--electron-exe',exe,...extra],{encoding:'utf8'}).status,2)})

test('three-member append preserves exact old payload and rejects missing, reordered or extra members',()=>{
 const payload=Buffer.from('AAABBBCCCKEEP'),header={files:{one:{size:3,offset:'0'},two:{size:3,offset:'3'},three:{size:3,offset:'6'},keep:{size:4,offset:'9'},native:{unpacked:true,size:7}},custom:'retained'}
 const original=Buffer.concat([encodeAsarHeader(header),payload])
 const next=appendRuntimeEntry(appendRuntimeEntry(appendRuntimeEntry(original,'one',Buffer.from('new-one')),'two',Buffer.from('new-two')),'three',Buffer.from('new-three'))
 assert.deepEqual(validateRuntimeAppend(original,next,['one','two','three']).changes,['one','two','three'])
 for(const names of [['one','two'],['three','two','one'],['one','two','three','keep'],['one','two','three','three']])assert.throws(()=>validateRuntimeAppend(original,next,names))
 assert.deepEqual(inspectAsarLayout(next).header.files.native,header.files.native)
})

test('Cordis Host runtime member remains an exact version-bound packed JS repair',async()=>{
 const {default:cordis}=await import('../lib/dsh-cordis-ownership-source.cjs')
 assert.equal(RUNTIME_PINS.cordis,'node_modules/@deepseek-ai/cordis/lib/index.js')
 assert.equal(RUNTIME_PINS.cordisBefore,cordis.BEFORE);assert.equal(RUNTIME_PINS.cordisAfter,cordis.AFTER)
 assert.equal(cordis.replacementCount,6)
 for(const bytes of [Buffer.from('unknown'),Buffer.alloc(0)])assert.throws(()=>cordis.buildCandidate(bytes),/UNSUPPORTED_CORDIS_SOURCE/)
 const f=fixture(),p=inspectAsarLayout(f.bytes)
 for(const field of ['link','unpacked','files']){const h=structuredClone(p.header);h.files.one[field]=field==='files'?{}:true;assert.throws(()=>appendRuntimeEntry(Buffer.concat([encodeAsarHeader(h),p.payload]),'one',Buffer.from('new')))}
})

test('two remaining SDK members are distinct, continuous and require the exact target list',()=>{
 const names=[RUNTIME_PINS.cordis,RUNTIME_PINS.subagent],header={files:{},retained:'root-metadata'}
 let offset=0
 for(const name of names){let h=header;const parts=name.split('/');for(const part of parts.slice(0,-1))h=h.files[part]??={files:{}};h.files[parts.at(-1)]={size:3,offset:String(offset)};offset+=3}
 const source=Buffer.concat([encodeAsarHeader(header),Buffer.from('AAABBB')]),next=appendRuntimeEntry(appendRuntimeEntry(source,names[0],Buffer.from('CORDIS-NEW')),names[1],Buffer.from('SUBAGENT-NEW'))
 assert.deepEqual(validateRuntimeAppend(source,next,names).changes,names)
 for(const list of [[names[0]],[names[1]],[names[1],names[0]],[names[0],names[1],names[1]]])assert.throws(()=>validateRuntimeAppend(source,next,list))
})

test('subagent source repair rejects unsupported bytes and archive builder rejects unknown bases',async()=>{
 const {default:subagent}=await import('../lib/dsh-subagent-ownership-source.cjs')
 assert.equal(RUNTIME_PINS.subagent,'node_modules/@deepseek-ai/dsh-tool-subagent/lib/index.js');assert.equal(RUNTIME_PINS.subagentBefore,subagent.BEFORE);assert.equal(RUNTIME_PINS.subagentAfter,subagent.AFTER);assert.equal(subagent.replacementCount,6)
 for(const bytes of [Buffer.alloc(0),Buffer.from('unknown')]){assert.throws(()=>subagent.buildCandidate(bytes),/UNSUPPORTED_SUBAGENT_SOURCE/);assert.throws(()=>subagent.restoreOriginal(bytes),/UNSUPPORTED_SUBAGENT_SOURCE/);assert.throws(()=>buildRuntimeArchive(bytes),/RUNTIME_STABILITY_FOOTER_BASE_PIN/)}
})
