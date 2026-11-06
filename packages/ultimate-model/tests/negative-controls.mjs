// Real staged-package negatives. Runner stays outside the distribution; cleanup
// unlinks only registered files and removes registered empty directories.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { distributionFiles } from '../scripts/distribution.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
if (!process.env.SKILL_INDEX_TEST_TMPDIR) throw new Error('Set SKILL_INDEX_TEST_TMPDIR outside user home')
const base = fs.realpathSync(process.env.SKILL_INDEX_TEST_TMPDIR), relativeHome = path.relative(os.homedir(), base)
assert.ok(relativeHome === '..' || relativeHome.startsWith('..' + path.sep) || path.isAbsolute(relativeHome))
const fixtures = new Map()
function stage() {
  const container = fs.mkdtempSync(path.join(base, 'jizhi-neg-')), dir = path.join(container, 'pack')
  const fixture = { container, dir, files: new Set(), directories: new Map() }
  const remember = full => { const s = fs.lstatSync(full, { bigint: true }); fixture.directories.set(full, { dev: s.dev, ino: s.ino, real: fs.realpathSync(full) }) }
  remember(container); fs.mkdirSync(dir); remember(dir)
  fixture.mkdir = full => {
    if (fixture.directories.has(full)) return
    fixture.mkdir(path.dirname(full)); fs.mkdirSync(full); remember(full)
  }
  fixtures.set(dir, fixture)
  for (const file of [...distributionFiles(root), 'FILES.sha256']) {
    const target = path.join(dir, file); fixture.mkdir(path.dirname(target)); fixture.files.add(target)
    fs.copyFileSync(path.join(root, file), target)
  }
  const regen = spawnSync(process.execPath, [path.join(dir, 'materialize.mjs'), '--out=cordis.patch.yml'], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 30000 })
  assert.equal(regen.status, 0, 'staged relocation failed: ' + String(regen.stderr).slice(0, 300))
  rehash(dir)
  return dir
}
function write(dir, name, text) { const f = fixtures.get(dir), full = path.join(dir, name); f.mkdir(path.dirname(full)); f.files.add(full); fs.writeFileSync(full, text) }
function rehash(dir) {
  const rows = distributionFiles(dir).map(file => file + '  ' + createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex'))
  write(dir, 'FILES.sha256', rows.join('\n') + '\n')
}
function runValidator(dir) {
  const fixture = fixtures.get(dir), runner = path.join(fixture.container, 'runner.mjs')
  fixture.files.add(runner)
  fs.writeFileSync(runner, 'import {validateBundle} from ' + JSON.stringify(pathToFileURL(path.join(dir, 'scripts/validate-bundle.mjs')).href) + '; try { validateBundle(' + JSON.stringify(dir) + '); console.log("OK"); } catch(e) { console.log(e.message); process.exitCode=1; }\n')
  const result = spawnSync(process.execPath, [runner], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 30000 })
  assert.equal(result.error, undefined); assert.equal(result.signal, null)
  return { exitCode: result.status, text: String(result.stdout).trim(), stderr: String(result.stderr).slice(0, 300) }
}
function cleanup(dir) {
  const f = fixtures.get(dir)
  for (const [full, expected] of f.directories) {
    const actual = fs.lstatSync(full, { bigint: true })
    assert.ok(actual.isDirectory() && !actual.isSymbolicLink()); assert.equal(actual.dev, expected.dev); assert.equal(actual.ino, expected.ino); assert.equal(fs.realpathSync(full), expected.real)
  }
  for (const file of f.files) {
    if (!fs.existsSync(file)) continue
    const info = fs.lstatSync(file); assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1)
    fs.unlinkSync(file)
  }
  for (const dir of [...f.directories.keys()].sort((a, b) => b.length - a.length)) fs.rmdirSync(dir)
  assert.equal(fs.existsSync(f.container), false)
}
const patch = dir => JSON.parse(fs.readFileSync(path.join(dir, 'cordis.patch.yml'), 'utf8'))
const cases = [
  { name: 'relocated baseline', mutate() {}, fail: false },
  { name: 'hash mismatch', mutate(dir) { const lines = fs.readFileSync(path.join(dir, 'FILES.sha256'), 'utf8').trim().split(/\r?\n/); lines[0] = lines[0].replace(/[a-f0-9]{64}$/, 'a'.repeat(64)); write(dir, 'FILES.sha256', lines.join('\n') + '\n') }, pattern: /integrity mismatch/, rehash: false },
  { name: 'context moved into preset', mutate(dir) { const p = patch(dir), i = p[0].insert.findIndex(r => r.id === 'ultimate-model-context-checkpoint'); p[0].insert[0].config.plugins.push(p[0].insert.splice(i, 1)[0]); write(dir, 'cordis.patch.yml', JSON.stringify(p)) }, pattern: /only this optional mode/ },
  { name: 'invalid bundle observer path', mutate(dir) { const p = patch(dir); p[0].insert[1].name = { __jsExpr: '"file:///nowhere.mjs"' }; write(dir, 'cordis.patch.yml', JSON.stringify(p)) }, pattern: /BUNDLE_PLUGIN_ENTRY/ },
  { name: 'skill dir outside package', mutate(dir) { const p = patch(dir); p[0].insert[0].config.plugins.find(r => r.id === 'skill-filesystem').config.customSkillDirs = [path.dirname(dir)]; write(dir, 'cordis.patch.yml', JSON.stringify(p)) }, pattern: /outside this package/ },
  { name: 'existing file omitted from manifest', mutate(dir) { const lines = fs.readFileSync(path.join(dir, 'FILES.sha256'), 'utf8').trim().split(/\r?\n/); write(dir, 'FILES.sha256', lines.slice(0, -1).join('\n') + '\n') }, pattern: /DISTRIBUTION_MANIFEST_COVERAGE/, rehash: false },
  { name: 'added file missing from manifest', mutate(dir) { write(dir, 'hooks/unmanifested.txt', 'not listed') }, pattern: /DISTRIBUTION_MANIFEST_COVERAGE/, rehash: false },
  { name: 'duplicate Host Inspect', mutate(dir) { const p = patch(dir); p[0].insert[0].config.plugins.push({ id: 'duplicate-host-inspect', name: '@deepseek-ai/dsh-tool-cordis/host' }); write(dir, 'cordis.patch.yml', JSON.stringify(p)) }, pattern: /second Host Inspect/ },
]
const results = []
for (const item of cases) {
  const dir = stage()
  try {
    item.mutate(dir)
    if (item.rehash !== false) rehash(dir)
    const outcome = runValidator(dir)
    assert.equal(outcome.exitCode, item.fail === false ? 0 : 1, item.name + ': ' + outcome.text + outcome.stderr)
    if (item.pattern) assert.match(outcome.text, item.pattern, item.name)
    results.push({ name: item.name, expectedExit: item.fail === false ? 0 : 1, actualExit: outcome.exitCode, passed: true })
  } finally { cleanup(dir) }
}
console.log(JSON.stringify({ cases: results.length, failures: 0, results, cleanup: 'registered files and empty directories only' }, null, 2))
