import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const slash = value => value.split(path.sep).join('/')
const safeRelative = value => typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').some(p => p === '..' || p === '.' || p === '')
export function distributionFiles(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0, 'DISTRIBUTION_FILES_REQUIRED')
  const actual = [], declared = new Set()
  const walk = (relative, output) => {
    const full = path.join(root, relative), info = fs.lstatSync(full)
    assert.ok(!info.isSymbolicLink(), 'DISTRIBUTION_LINK: ' + relative)
    if (info.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) {
        assert.ok(!['.dsh', 'node_modules'].includes(name) && !/\.bak-|\.zip$|\.tgz$/.test(name), 'DISTRIBUTION_PRIVATE_OR_BUILD_FILE: ' + name)
        if (name === '.git') continue
        walk(relative ? relative + '/' + name : name, output)
      }
    } else { assert.ok(info.isFile(), 'DISTRIBUTION_NOT_FILE: ' + relative); output.push(slash(relative)) }
  }
  walk('', actual)
  for (const item of pkg.files) {
    assert.ok(safeRelative(item), 'DISTRIBUTION_UNSAFE_PATH: ' + item)
    const found = []; walk(item, found)
    for (const file of found) declared.add(file)
  }
  declared.delete('FILES.sha256')
  const disk = actual.filter(file => file !== 'FILES.sha256').sort()
  assert.deepEqual([...declared].sort(), disk, 'DISTRIBUTION_PACKAGE_FILES_INCOMPLETE')
  return disk
}
export function validateManifestCoverage(root, rows) {
  assert.deepEqual([...rows].sort(), distributionFiles(root), 'DISTRIBUTION_MANIFEST_COVERAGE')
}
