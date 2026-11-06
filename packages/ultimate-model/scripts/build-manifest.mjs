import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { distributionFiles } from './distribution.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
if (args.some(a => a !== '--check')) throw new Error('Only --check is supported')
const files = distributionFiles(root)
const text = files.map(file => file + '  ' + createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')).join('\n') + '\n'
const manifest = path.join(root, 'FILES.sha256')
if (args.includes('--check')) {
  if (fs.readFileSync(manifest, 'utf8') !== text) throw new Error('MANIFEST_DRIFT')
} else fs.writeFileSync(manifest, text)
console.log(JSON.stringify({ ok: true, files: files.length, checkOnly: args.includes('--check') }))
