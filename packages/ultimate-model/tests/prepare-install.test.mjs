import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const root=fileURLToPath(new URL('..',import.meta.url))
function fixture(){
 const base=path.resolve(process.env.SKILL_INDEX_TEST_TMPDIR||os.tmpdir()),rel=path.relative(os.homedir(),base)
 assert.ok(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))
 const target=fs.mkdtempSync(path.join(base,'prepare-install-'))
 fs.cpSync(root,path.join(target,'package'),{recursive:true})
 const copy=path.join(target,'package')
 return{copy,target,run:args=>spawnSync(process.execPath,[path.join(copy,'scripts/prepare-install.mjs'),...args],{cwd:target,encoding:'utf8'})}
}
function image(dir){return fs.readdirSync(dir,{recursive:true,withFileTypes:true}).filter(x=>x.isFile()).map(x=>{const f=path.join(x.parentPath,x.name);return[path.relative(dir,f),createHash('sha256').update(fs.readFileSync(f)).digest('hex')]}).sort()}
test('prepare refuses tampered helper before it executes any local dependency',()=>{
 const f=fixture(),marker=path.join(f.target,'unexpected-execution')
 fs.writeFileSync(path.join(f.copy,'materialize.mjs'),`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marker)},'executed')`)
 const before=image(f.copy),r=f.run(['--check'])
 assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/DISTRIBUTION_REJECTED.*HASH_MISMATCH/)
 assert.equal(fs.existsSync(marker),false);assert.deepEqual(image(f.copy),before)
})
test('prepare check rejects extra unpublished file without executing or modifying it',()=>{
 const f=fixture();fs.writeFileSync(path.join(f.copy,'unpublished-state.json'),'{}\n')
 const before=image(f.copy),r=f.run(['--check'])
 assert.equal(r.status,1);assert.match(r.stderr,/MANIFEST_COVERAGE/);assert.deepEqual(image(f.copy),before)
})
test('unknown prepare options are rejected before any package write',()=>{
 const f=fixture(),before=image(f.copy),r=f.run(['--unknown'])
 assert.equal(r.status,2);assert.deepEqual(image(f.copy),before)
})
