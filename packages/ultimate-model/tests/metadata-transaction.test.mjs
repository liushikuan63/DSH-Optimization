import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { build, collect, planBuild, renderBuildDocument } from '../scripts/build-skills-index.mjs'

const ownRoot = path.resolve(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const relativeToHome=path.relative(os.homedir(),ownRoot)
if(!relativeToHome||(!relativeToHome.startsWith('..'+path.sep)&&!path.isAbsolute(relativeToHome)))throw Error('Set SKILL_INDEX_TEST_TMPDIR outside user home')
const fixture = t => {
  const root=fs.mkdtempSync(path.join(ownRoot,'transaction-'))
  // Keep these exclusively owned fixtures and recovery records for inspection.
  const file=(name,bytes)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);return p}
  return {root,file,read:name=>fs.readFileSync(path.join(root,name),'utf8')}
}
const skill=(name,description='fixture metadata')=>`---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`
const current=(f)=>({json:f.read('skills-index.json'),markdown:f.read('INDEX.md')})
const payloads=[{name:'skills-index.json',bytes:Buffer.from('new json')},{name:'INDEX.md',bytes:Buffer.from('new markdown')}]
async function helper(){return await import('../scripts/metadata-transaction.mjs')}

test('a real second-output filesystem failure cannot leave new JSON paired with old Markdown',t=>{
  const f=fixture(t);f.file('skills/one/SKILL.md',skill('one'));f.file('skills-index.json','old json');f.file('INDEX.md','old markdown')
  const before=current(f),oldWrite=fs.writeFileSync,oldLink=fs.linkSync,oldRename=fs.renameSync
  let injected=false
  const fail=target=>{if(!injected&&path.resolve(String(target))===path.join(f.root,'INDEX.md')){injected=true;throw Object.assign(Error('injected publication IO'),{code:'EIO'})}}
  fs.writeFileSync=(target,...args)=>{fail(target);return oldWrite(target,...args)}
  fs.linkSync=(source,target,...args)=>{fail(target);return oldLink(source,target,...args)}
  fs.renameSync=(source,target,...args)=>{fail(target);return oldRename(source,target,...args)}
  try { assert.throws(()=>build({home:f.root,quiet:true,env:{}}),/injected/);assert.deepEqual(current(f),before) }
  finally {fs.writeFileSync=oldWrite;fs.linkSync=oldLink;fs.renameSync=oldRename}
})

test('bundle collection includes the shipped local tier', t=>{
  const f=fixture(t);f.file('skills/core/core/SKILL.md',skill('core'));f.file('skills/local/local/SKILL.md',skill('local'))
  assert.deepEqual(collect({bundleRoot:f.root}).map(e=>e.name).sort(),['core','local'])
})
test('failed second publication restores both existing preimages',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t)
  f.file('skills-index.json','old json');f.file('INDEX.md','old markdown');const before=current(f)
  assert.throws(()=>publishMetadataPair(f.root,payloads,{onPhase:({phase,index})=>{if(phase==='after-publish'&&index===1)throw Error('injected second publication failure')}}),/injected/)
  assert.deepEqual(current(f),before)
})
test('publication CAS preserves a concurrent target change',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t)
  f.file('skills-index.json','old json');f.file('INDEX.md','old markdown')
  assert.throws(()=>publishMetadataPair(f.root,payloads,{onPhase:({phase})=>{if(phase==='prepared')f.file('INDEX.md','concurrent markdown')}}),/CONFLICT/)
  assert.equal(f.read('INDEX.md'),'concurrent markdown');assert.equal(f.read('skills-index.json'),'old json')
})
test('rollback moves then verifies before deleting: replacement at old check-unlink boundary survives',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t);const foreign='foreign replacement after ownership check'
  let replaced=false
  assert.throws(()=>publishMetadataPair(f.root,payloads,{onPhase:({phase,index})=>{
    if(phase==='after-publish'&&index===1)throw Error('force rollback')
    if(phase==='rollback-before-withdraw'&&index===1&&!replaced){
      fs.renameSync(path.join(f.root,'INDEX.md'),path.join(f.root,'held-original-transaction-output'))
      f.file('INDEX.md',foreign);replaced=true
    }
  }}),/RECOVERY_REQUIRED/)
  assert.equal(f.read('INDEX.md'),foreign)
  const stage=fs.readdirSync(f.root).find(n=>n.startsWith('.skills-index-txn-'))
  assert.ok(stage);assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,stage,'journal.json'),'utf8')).status,'recovery-required')
})
test('exclusive publication never replaces a concurrently created missing target',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t)
  assert.throws(()=>publishMetadataPair(f.root,payloads,{onPhase:({phase,index})=>{if(phase==='before-publish'&&index===1)f.file('INDEX.md','foreign new file')}}),/CONFLICT|RECOVERY_REQUIRED/)
  assert.equal(f.read('INDEX.md'),'foreign new file');assert.equal(fs.existsSync(path.join(f.root,'skills-index.json')),false)
})
test('successful builder publishes one snapshot and leaves no transaction debris',t=>{
  const f=fixture(t);f.file('skills/one/SKILL.md',skill('one'))
  const doc=build({home:f.root,quiet:true,env:{}})
  const json=JSON.parse(f.read('skills-index.json'))
  assert.equal(json.generated_at,doc.generated_at);assert.match(f.read('INDEX.md'),new RegExp(doc.generated_at.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))
  assert.deepEqual(fs.readdirSync(f.root).sort(),['INDEX.md','skills','skills-index.json'])
})

test('a caller can render an already collected document without recollecting or writing',t=>{
  const f=fixture(t);f.file('skills/one/SKILL.md',skill('one'))
  const plan=build({home:f.root,quiet:true,env:{},dryRun:true})
  assert.equal(plan.doc.count,1);assert.deepEqual(fs.readdirSync(f.root),['skills'])
  plan.doc.entries[0].path='final/core/one/SKILL.md'
  const rendered=renderBuildDocument(plan.doc)
  assert.ok(rendered[1].bytes.toString().includes('final/core/one/SKILL.md'))
  assert.equal(JSON.parse(rendered[0].bytes).entries[0].path,'final/core/one/SKILL.md')
})
test('third derived state output rolls back with the JSON and Markdown',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t)
  f.file('skills-index.json','old json');f.file('INDEX.md','old markdown');f.file('skills-tier-state.json','old state');const before=current(f)
  assert.throws(()=>publishMetadataPair(f.root,payloads,{additionalOutputs:[{name:'skills-tier-state.json',bytes:'new state'}],onPhase:({phase,index})=>{if(phase==='after-publish'&&index===2)throw Error('state publication failure')}}),/state publication failure/)
  assert.deepEqual(current(f),before);assert.equal(f.read('skills-tier-state.json'),'old state')
})
test('build accepts a pre-move plan and refuses concurrent metadata changes instead of adopting them',t=>{
  const f=fixture(t);f.file('skills/one/SKILL.md',skill('one'));f.file('skills-index.json','old json');f.file('INDEX.md','old markdown');f.file('skills-tier-state.json','old state')
  const additionalOutputs=[{name:'skills-tier-state.json',bytes:Buffer.from('new state')}]
  const baseline=planBuild({home:f.root,quiet:true,env:{},additionalOutputs})
  assert.equal(baseline.preimages.length,3);assert.equal(baseline.preimages[0].before.hash.length,64)
  f.file('INDEX.md','concurrent writer')
  assert.throws(()=>build({home:f.root,quiet:true,env:{},additionalOutputs,preimages:baseline.preimages}),/CONFLICT/)
  assert.equal(f.read('skills-index.json'),'old json');assert.equal(f.read('INDEX.md'),'concurrent writer');assert.equal(f.read('skills-tier-state.json'),'old state')
})
test('successful build publishes caller additional state in the same journalled transaction',t=>{
  const f=fixture(t);f.file('skills/one/SKILL.md',skill('one'))
  build({home:f.root,quiet:true,env:{},additionalOutputs:[{name:'skills-tier-state.json',bytes:Buffer.from('new state')}]})
  assert.equal(f.read('skills-tier-state.json'),'new state');assert.equal(fs.readdirSync(f.root).some(n=>n.startsWith('.skills-index-')),false)
})
test('an existing foreign lock is never cleared or retried as a stale lock',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t);f.file('.skills-index.lock','foreign owner')
  assert.throws(()=>publishMetadataPair(f.root,payloads),error=>error.code==='EEXIST')
  assert.equal(f.read('.skills-index.lock'),'foreign owner');assert.equal(fs.existsSync(path.join(f.root,'skills-index.json')),false)
})
test('short Windows EPERM publication failures retry only the bounded ownership-checked operation',async t=>{
  if(process.platform!=='win32')return t.skip('Windows-specific boundary')
  const {publishMetadataPair}=await helper();const f=fixture(t);const raw=fs.linkSync;let attempts=0
  fs.linkSync=(source,target,...args)=>{if(target===path.join(f.root,'skills-index.json')&&++attempts<3)throw Object.assign(Error('sharing boundary'),{code:'EPERM'});return raw(source,target,...args)}
  try{publishMetadataPair(f.root,payloads);assert.equal(attempts,3);assert.equal(f.read('skills-index.json'),'new json')}finally{fs.linkSync=raw}
})
test('a late CAS conflict before the second withdrawal restores the first output and preserves the foreign second',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t);f.file('skills-index.json','old json');f.file('INDEX.md','old markdown')
  assert.throws(()=>publishMetadataPair(f.root,payloads,{onPhase:({phase,index})=>{if(phase==='after-publish'&&index===0)f.file('INDEX.md','late concurrent markdown')}}),/CONFLICT/)
  assert.equal(f.read('skills-index.json'),'old json');assert.equal(f.read('INDEX.md'),'late concurrent markdown')
})
test('pending recovery records are never silently ignored or deleted by a later build',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t)
  let inserted=false
  assert.throws(()=>publishMetadataPair(f.root,payloads,{onPhase:({phase,index})=>{
    if(phase==='after-publish'&&index===1)throw Error('force rollback')
    if(phase==='rollback-before-withdraw'&&index===1&&!inserted){fs.renameSync(path.join(f.root,'INDEX.md'),path.join(f.root,'held'));f.file('INDEX.md','foreign');inserted=true}
  }}),/RECOVERY_REQUIRED/)
  const before=fs.readdirSync(f.root).sort()
  assert.throws(()=>publishMetadataPair(f.root,payloads),/PENDING_RECOVERY/)
  assert.deepEqual(fs.readdirSync(f.root).sort(),before);assert.equal(f.read('INDEX.md'),'foreign')
})
test('failed new-file publication with no concurrent writer restores absence for every output',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t)
  assert.throws(()=>publishMetadataPair(f.root,payloads,{onPhase:({phase,index})=>{if(phase==='after-publish'&&index===1)throw Error('rollback all new files')}}),/rollback all new files/)
  assert.equal(fs.existsSync(path.join(f.root,'skills-index.json')),false);assert.equal(fs.existsSync(path.join(f.root,'INDEX.md')),false)
  const stage=fs.readdirSync(f.root).find(n=>n.startsWith('.skills-index-txn-'))
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,stage,'journal.json'))).status,'rolled-back')
})
test('safety rejects invalid basenames and same-byte inode replacement without retry or writes',async t=>{
  const {publishMetadataPair,captureMetadataPreimages}=await helper();const f=fixture(t)
  f.file('cordis.patch.yml','before');const preimages=captureMetadataPreimages(f.root,['cordis.patch.yml'])
  fs.renameSync(path.join(f.root,'cordis.patch.yml'),path.join(f.root,'held-preimage'));f.file('cordis.patch.yml','before')
  assert.throws(()=>publishMetadataPair(f.root,[{name:'cordis.patch.yml',bytes:'after'}],{preimages}),/CONFLICT/)
  assert.throws(()=>publishMetadataPair(f.root,[{name:'../outside.json',bytes:'no'}]),/OUTPUT_NAME/)
  assert.equal(f.read('cordis.patch.yml'),'before');assert.equal(fs.readdirSync(f.root).some(n=>n.startsWith('.skills-index-')),false)
})
test('a safe arbitrary basename supports a single-file configuration transaction',async t=>{
  const {publishMetadataPair}=await helper();const f=fixture(t);f.file('cordis.patch.yml','before')
  publishMetadataPair(f.root,[{name:'cordis.patch.yml',bytes:'after'}])
  assert.equal(f.read('cordis.patch.yml'),'after');assert.deepEqual(fs.readdirSync(f.root),['cordis.patch.yml'])
})
