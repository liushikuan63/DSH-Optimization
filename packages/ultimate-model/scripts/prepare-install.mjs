// Verify the distributed bytes before generating paths for this copy. This
// changes only package-local derived files; it never installs a DSH profile.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
if (args.some(arg => !['--check', '--tests'].includes(arg)) || new Set(args).size !== args.length || (args.includes('--check') && args.includes('--tests'))) {
  console.error('USAGE: node scripts/prepare-install.mjs [--check | --tests]')
  process.exit(2)
}
function run(relative, extra = []) {
  const result = spawnSync(process.execPath, [path.join(root, relative), ...extra], { cwd: root, stdio: 'inherit' })
  if (result.error) { console.error(result.error.message); process.exit(1) }
  if (result.status !== 0) process.exit(result.status || 1)
}
// Read data and use Node builtins before running any package-local dependency.
// This bootstrap is not a signature: authenticate the ZIP/this entrypoint from
// an independent trusted source before executing code from an unknown archive.
try {
  const declared = new Map()
  for (const line of fs.readFileSync(path.join(root, 'FILES.sha256'), 'utf8').trim().split(/\r?\n/)) {
    const match = /^(\S.*?)  ([a-f0-9]{64})$/.exec(line)
    if (!match || /[\\:\x00-\x1f]/.test(match[1]) || match[1].split('/').some(x => !x || x === '.' || x === '..') || match[1] === 'FILES.sha256' || declared.has(match[1].toLowerCase())) throw Error('INVALID_MANIFEST')
    declared.set(match[1].toLowerCase(), { name: match[1], hash: match[2] })
  }
  const actual = []
  function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' && !prefix) continue
      const relative = prefix + entry.name, file = path.join(dir, entry.name), stat = fs.lstatSync(file)
      if (stat.isSymbolicLink()) throw Error('DISTRIBUTION_LINK: ' + relative)
      if (stat.isDirectory()) walk(file, relative + '/')
      else if (stat.isFile() && relative !== 'FILES.sha256') actual.push(relative)
      else if (!stat.isFile()) throw Error('DISTRIBUTION_TYPE: ' + relative)
    }
  }
  walk(root)
  if (actual.length !== declared.size) throw Error('MANIFEST_COVERAGE')
  for (const name of actual) {
    const expected = declared.get(name.toLowerCase())
    if (expected?.name !== name || createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex') !== expected.hash) throw Error('HASH_MISMATCH: ' + name)
  }
} catch (error) { console.error('DISTRIBUTION_REJECTED: ' + error.message); process.exit(1) }
run('materialize.mjs', ['--check'])
if (args.includes('--check')) {
  console.log('DISTRIBUTION_VERIFIED: template resources resolve; profile installation and current runtime are unverified.')
} else {
  run('materialize.mjs')
  run('scripts/selfcheck.mjs', args.includes('--tests') ? ['--tests'] : [])
  console.log('PREPARED: package-local paths verified. Install this exact directory with the official bundle manager; inspect existing Home overrides first.')
}
