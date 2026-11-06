import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { distributionFiles } from './distribution.mjs'
export function auditReferences(root, files = distributionFiles(root)) {
  let links = 0, documents = 0
  for (const file of files.filter(name => name.endsWith('.md'))) {
    documents++
    const text = fs.readFileSync(path.join(root, file), 'utf8')
      .replace(/^\s*```[^\n]*\n[\s\S]*?^\s*```\s*$/gm, '')
      .replace(/`[^`\n]*`/g, '')
    for (const match of text.matchAll(/\]\(<?([^)>]+)>?\)/g)) {
      const target = match[1].trim()
      if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('#')) continue
      const [reference, anchor] = target.split('#')
      if (!reference) continue
      const resolved = path.resolve(root, path.dirname(file), decodeURIComponent(reference))
      const relative = path.relative(root, resolved)
      assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), 'REFERENCE_OUTSIDE_PACKAGE: ' + file + ': ' + target)
      assert.ok(fs.existsSync(resolved), 'REFERENCE_MISSING: ' + file + ': ' + target)
      const lines = /^L(\d+)(?:-L(\d+))?$/.exec(anchor ?? '')
      if (lines) {
        const count = fs.readFileSync(resolved, 'utf8').split(/\r?\n/).length
        assert.ok(Number(lines[1]) > 0 && Number(lines[2] ?? lines[1]) >= Number(lines[1]) && Number(lines[2] ?? lines[1]) <= count, 'REFERENCE_LINE_RANGE: ' + file + ': ' + target)
      }
      links++
    }
  }
  return { documents, localLinks: links, scope: 'Markdown local targets and numeric line anchors; fenced/inline examples and remote URLs excluded' }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  console.log(JSON.stringify(auditReferences(root)))
}
