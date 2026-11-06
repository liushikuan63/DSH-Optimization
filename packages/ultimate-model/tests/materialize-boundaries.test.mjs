import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { distributionFiles } from '../scripts/distribution.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const hash = value => createHash('sha256').update(value).digest('hex')
function stage(t) {
  const dir = fs.mkdtempSync(path.join(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir(), 'materialize-boundary-'))
  const files = [], dirs = new Set([dir])
  const mkdir = full => { if (dirs.has(full)) return; mkdir(path.dirname(full)); fs.mkdirSync(full); dirs.add(full) }
  for (const name of [...distributionFiles(root), 'FILES.sha256']) {
    const full = path.join(dir, name); mkdir(path.dirname(full)); fs.copyFileSync(path.join(root, name), full); files.push(full)
  }
  t.after(() => {
    for (const file of files) { const info = fs.lstatSync(file); assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1); fs.unlinkSync(file) }
    for (const directory of [...dirs].sort((a, b) => b.length - a.length)) fs.rmdirSync(directory)
  })
  const template = path.join(dir, 'cordis.patch.template.yml')
  return { dir, template,
    extra(name, text) { const file=path.join(dir,name);fs.writeFileSync(file,text);files.push(file);return file },
    read() { return JSON.parse(fs.readFileSync(template, 'utf8')) },
    write(data) { fs.writeFileSync(template, JSON.stringify(data, null, 2)) },
    snapshot() { return files.map(file => [file, hash(fs.readFileSync(file))]) },
    run(...args) { return spawnSync(process.execPath, ['materialize.mjs', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 15000 }) },
  }
}
function resources(doc) {
  const rows = doc[0].insert, plugins = rows[0].config.plugins
  return { observer: rows.find(row => row.id === 'ultimate-model-context-checkpoint'), skills: plugins.find(row => row.id === 'skill-filesystem').config.customSkillDirs }
}

test('unknown, duplicate and empty materializer options fail before any file changes', t => {
  const f = stage(t)
  for (const args of [['--chek'], ['--check=false'], ['--check', '--check'], ['--out='], ['--template='], ['--out=a.yml', '--out=b.yml']]) {
    const before = f.snapshot(), result = f.run(...args)
    assert.notEqual(result.status, 0, JSON.stringify(args) + ': ' + result.stdout)
    assert.deepEqual(f.snapshot(), before)
    assert.equal(fs.existsSync(path.join(f.dir, 'a.yml')), false)
  }
})

for (const scenario of ['missing-plugin', 'missing-skill-dir', 'plugin-is-directory', 'skill-is-file', 'outside-package']) {
  test(`materializer checks literal resource existence, type and ownership: ${scenario}`, t => {
    const f = stage(t), doc = f.read(), { observer, skills } = resources(doc)
    if (scenario === 'missing-plugin') observer.name = pathToFileURL(path.join(f.dir, 'missing.mjs')).href
    if (scenario === 'missing-skill-dir') skills[0] = path.join(f.dir, 'missing-skills')
    if (scenario === 'plugin-is-directory') observer.name = pathToFileURL(f.dir).href
    if (scenario === 'skill-is-file') skills[0] = path.join(f.dir, 'package.json')
    if (scenario === 'outside-package') observer.name = pathToFileURL(path.join(root, 'mode-runtime.mjs')).href
    f.write(doc)
    const before = f.snapshot(), result = f.run('--check')
    assert.notEqual(result.status, 0, result.stdout)
    assert.deepEqual(f.snapshot(), before)
  })
}

test('path expressions are parsed as the shipped resolver grammar without executing extra JavaScript', t => {
  const f = stage(t), doc = f.read(), { observer } = resources(doc)
  observer.name = { __jsExpr: '(() => { console.log("UNTRUSTED_RESOLVER_RAN"); process.exit(0); })()' }
  f.write(doc)
  const before = f.snapshot(), result = f.run('--check')
  assert.notEqual(result.status, 0)
  assert.doesNotMatch(result.stdout, /UNTRUSTED_RESOLVER_RAN/)
  assert.deepEqual(f.snapshot(), before)
})

test('a template edit after its first read is preserved without blessing stale derived paths', t => {
  const f=stage(t),active=path.join(f.dir,'cordis.patch.yml'),manifest=path.join(f.dir,'FILES.sha256')
  const before=[fs.readFileSync(active),fs.readFileSync(manifest)]
  const preload=f.extra('race-preload.mjs',`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.readFileSync;let changed=false;fs.readFileSync=function(file,...args){const bytes=original.call(this,file,...args);if(file===${JSON.stringify(f.template)}&&!changed){changed=true;const doc=JSON.parse(bytes);doc[0].insert[0].config.plugins.find(row=>row.id==='persona').config.prefix='concurrent-user-template';fs.writeFileSync(file,JSON.stringify(doc,null,2));}return bytes};syncBuiltinESMExports();`)
  const r=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,'materialize.mjs'],{cwd:f.dir,encoding:'utf8',windowsHide:true})
  assert.notEqual(r.status,0,r.stdout);assert.match(r.stderr,/MATERIALIZE_DEPENDENCY_CHANGED/)
  assert.match(fs.readFileSync(f.template,'utf8'),/concurrent-user-template/)
  assert.deepEqual([fs.readFileSync(active),fs.readFileSync(manifest)],before)
})

