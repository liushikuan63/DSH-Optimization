import os from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { distributionFiles, validateManifestCoverage } from '../scripts/distribution.mjs'
import { auditReferences } from '../scripts/audit-references.mjs'
test('manifest and package inventory cannot omit a real file; local-reference checker fails on planted defects', t => {
 const root = fs.mkdtempSync(path.join((process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir()), 'jizhi-inventory-test-')), files = []
 const write = (name, text) => { const full = path.join(root, name); fs.writeFileSync(full, text); if (!files.includes(full)) files.push(full) }
 t.after(() => { for (const file of files.reverse()) fs.unlinkSync(file); fs.rmdirSync(root) })
 write('package.json', JSON.stringify({ files: ['package.json', 'a.md', 'FILES.sha256'] }))
 write('a.md', '[valid](package.json)\n`![example](not-a-resource "width")`\n')
 write('FILES.sha256', '')
 const inventory = distributionFiles(root)
 assert.deepEqual(inventory, ['a.md', 'package.json'])
 validateManifestCoverage(root, inventory)
 assert.throws(() => validateManifestCoverage(root, ['package.json']), /MANIFEST_COVERAGE/)
 assert.throws(() => validateManifestCoverage(root, [...inventory, 'ghost']), /MANIFEST_COVERAGE/)
 assert.equal(auditReferences(root, inventory).localLinks, 1)
 write('a.md', '[missing](missing.txt)\n')
 assert.throws(() => auditReferences(root, inventory), /REFERENCE_MISSING/)
 write('a.md', '[escape](../outside)\n')
 assert.throws(() => auditReferences(root, inventory), /REFERENCE_OUTSIDE_PACKAGE/)
 write('unlisted.txt', 'must not silently enter or disappear from a release')
 assert.throws(() => distributionFiles(root), /PACKAGE_FILES_INCOMPLETE/)
})
