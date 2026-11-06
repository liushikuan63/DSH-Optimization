import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {build} from '../scripts/build-skills-index.mjs'
import {runTier} from '../scripts/tier-skills.mjs'
const script=fileURLToPath(new URL('../scripts/tier-skills.mjs',import.meta.url))
function fixture(){
 const base=path.resolve(process.env.SKILL_INDEX_TEST_TMPDIR||os.tmpdir())
 const rel=path.relative(os.homedir(),base)
 assert.ok(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel),'fixtures must be outside user home')
 const home=fs.mkdtempSync(path.join(base,'tier-transaction-'))
 const add=(name,description='owned fixture')=>{const dir=path.join(home,'skills',name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'SKILL.md'),`---\nname: ${name}\ndescription: ${description}\n---\n`)}
 add('verify-before-claim');add('owned-library-skill');build({home,quiet:true})
 fs.writeFileSync(path.join(home,'skills-tier-state.json'),'{"moves":[]}\n')
 const run=(args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',env:{...process.env,DSH_HOME:home,DSH_AGENTS_HOME:''}})
 const snapshot=()=>Object.fromEntries(['skills-index.json','INDEX.md','skills-tier-state.json'].map(name=>[name,fs.readFileSync(path.join(home,name),'utf8')]))
 return {home,add,run,snapshot}
}
test('invalid frontmatter is rejected before moving skills or publishing any state',()=>{
 const f=fixture(),before=f.snapshot();f.add('z-invalid','"unterminated')
 const r=f.run(['--apply']);assert.notEqual(r.status,0)
 assert.ok(fs.existsSync(path.join(f.home,'skills/owned-library-skill/SKILL.md')))
 assert.equal(fs.existsSync(path.join(f.home,'skills-library/owned-library-skill')),false)
 assert.deepEqual(f.snapshot(),before)
})
test('metadata publication failure restores moved directories and preserves old state',()=>{
 const f=fixture(),before=f.snapshot()
 fs.unlinkSync(path.join(f.home,'INDEX.md'));fs.mkdirSync(path.join(f.home,'INDEX.md'))
 const r=f.run(['--apply']);assert.notEqual(r.status,0)
 assert.ok(fs.existsSync(path.join(f.home,'skills/owned-library-skill/SKILL.md')))
 assert.equal(fs.existsSync(path.join(f.home,'skills-library/owned-library-skill')),false)
 assert.equal(fs.readFileSync(path.join(f.home,'skills-index.json'),'utf8'),before['skills-index.json'])
 assert.equal(fs.readFileSync(path.join(f.home,'skills-tier-state.json'),'utf8'),before['skills-tier-state.json'])
 assert.ok(fs.statSync(path.join(f.home,'INDEX.md')).isDirectory())
})
test('successful migration and restore keep live entries, readable directory and state aligned',()=>{
 const f=fixture(),r=f.run(['--apply']);assert.equal(r.status,0,r.stderr)
 assert.equal(fs.existsSync(path.join(f.home,'skills/owned-library-skill')),false)
 assert.ok(fs.existsSync(path.join(f.home,'skills-library/owned-library-skill/SKILL.md')))
 assert.equal(build({home:f.home,quiet:true,check:true}).drift.length,0)
 const restored=f.run(['--restore','owned-library-skill','--apply']);assert.equal(restored.status,0,restored.stderr)
 assert.ok(fs.existsSync(path.join(f.home,'skills/owned-library-skill/SKILL.md')))
 assert.equal(build({home:f.home,quiet:true,check:true}).drift.length,0)
})
test('unknown flags fail before changes instead of silently becoming an apply option',()=>{
 const f=fixture(),before=f.snapshot(),r=f.run(['--apply','--unknown']);assert.equal(r.status,2,r.stderr)
 assert.deepEqual(f.snapshot(),before)
 assert.ok(fs.existsSync(path.join(f.home,'skills/owned-library-skill/SKILL.md')))
})
test('a concurrent tier-state edit between read and planning cannot become the overwrite baseline',()=>{
 const f=fixture(),state=path.join(f.home,'skills-tier-state.json'),read=fs.readFileSync
 let injected=false,error
 try{
  fs.readFileSync=function(file,...args){
   const bytes=read.call(this,file,...args)
   if(typeof file==='string'&&path.resolve(file)===state&&!injected){injected=true;fs.writeFileSync(state,'{"moves":[{"name":"concurrent-user-record"}]}\n')}
   return bytes
  }
  try{runTier(['--apply'],{DSH_HOME:f.home})}catch(e){error=e}
 }finally{fs.readFileSync=read}
 assert.equal(injected,true);assert.ok(error,'must reject the changed preimage')
 assert.ok(JSON.parse(fs.readFileSync(state,'utf8')).moves.some(x=>x.name==='concurrent-user-record'))
 assert.ok(fs.existsSync(path.join(f.home,'skills/owned-library-skill/SKILL.md')))
})
