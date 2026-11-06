/**
 * Materialize this pack's cordis.patch.yml into a machine-specific overlay.
 *
 * WHY THIS EXISTS
 * The profile compatibility preflight reads `row.name` BEFORE the Loader
 * evaluates `!!js` expressions (dsh-app-boot/lib/index.js:2265 `name.startsWith`).
 * A row whose name is an expression is therefore disabled with
 * "name.startsWith is not a function". Literal names pass.
 *
 * The archive keeps portable `__jsExpr` resolvers; this script parses their
 * supported path grammar and writes the active literal patch for this copy.
 * It never evaluates arbitrary template JavaScript.
 *
 * Usage:
 *   node materialize.mjs [--out=<file>] [--check]
 *   default: rewrite the active cordis.patch.yml in this package
 *   --check  verify every expression resolves to an existing file, write nothing
 */
import { readFileSync, existsSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { dirname, basename, join, resolve, sep, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePackageExpression } from './scripts/package-resource.mjs'
import { publishMetadataPair, captureMetadataPreimages } from './scripts/metadata-transaction.mjs'

const PACKAGE = '@local/ultimate-model'
const root = dirname(fileURLToPath(import.meta.url))
const options = new Map()
for (const argument of process.argv.slice(2)) {
  const key = argument === '--check' ? '--check' : argument.startsWith('--out=') ? '--out' : argument.startsWith('--template=') ? '--template' : undefined
  const value = key === '--check' ? true : key === undefined ? undefined : argument.slice(key.length + 1)
  if (key === undefined || options.has(key) || value === '') {
    console.error('USAGE: node materialize.mjs [--check] [--out=<file>] [--template=<file>]; unknown, duplicate and empty options are refused')
    process.exit(2)
  }
  options.set(key, value)
}
const checkOnly = options.has('--check')
const outArg = options.get('--out')
const out = outArg === undefined ? join(root, 'cordis.patch.yml') : resolve(outArg)
const outputHome = dirname(out)
const plannedNames = [basename(out), ...(out === join(root, 'cordis.patch.yml') && existsSync(join(root, 'FILES.sha256')) ? ['FILES.sha256'] : [])]
// Capture before resolving/serializing; a concurrent writer cannot become a
// new baseline merely because template validation took time.
const preimages = captureMetadataPreimages(outputHome, plannedNames)
const templateArg = options.get('--template')
// Source of resolvers: an explicit template, else the portable template that
// ships alongside, else the current patch (already literal on the author box).
const template = templateArg !== undefined
  ? resolve(templateArg)
  : (existsSync(join(root, 'cordis.patch.template.yml')) ? join(root, 'cordis.patch.template.yml') : join(root, 'cordis.patch.yml'))

const requireFromPack = createRequire(join(root, 'package.json'))
// The bundled parser makes relocation independent of the author's Host install.
const { load: parse } = requireFromPack('./vendor/js-yaml.js')

/**
 * This package's own root — the copy the script lives in.
 *
 * This MUST NOT be derived by resolving the package name: on a relocated copy
 * the name still resolves to wherever the package is installed, which is how a
 * previous version reported success while leaving the AUTHOR's absolute paths
 * in the output. The script knows its own directory; use that.
 */
const resolvedRoot = root

/** Validate both portable expressions and already materialized literals. */
function resource(entry, label, directory) {
  let value
  if (typeof entry === 'string') value = entry.startsWith('file:') ? fileURLToPath(entry) : entry
  else {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 1) throw new Error(`${label}: invalid resource descriptor`)
    value = resolvePackageExpression(entry.__jsExpr, resolvedRoot)
  }
  if (!isAbsolute(value)) throw new Error(`${label}: expected absolute resource path`)
  if (!existsSync(value)) throw new Error(`${label}: resolved path does not exist: ${value}`)
  const here = realpathSync(resolvedRoot), there = realpathSync(value), rel = relative(here, there)
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error(`${label}: resolved path is outside this package copy`)
  const info = statSync(there)
  if (directory ? !info.isDirectory() : !info.isFile()) throw new Error(`${label}: expected ${directory ? 'directory' : 'regular file'}`)
  return value
}

const source = template
const mirror = join(root, 'preset', 'agent.cordis.yml.tpl')
const dependencies = [source, ...(out === join(root, 'cordis.patch.yml') ? [mirror] : [])].map(file => ({ file, pins: captureMetadataPreimages(dirname(file), [basename(file)]) }))
const sourceBytes = readFileSync(source), mirrorBytes = out === join(root, 'cordis.patch.yml') ? readFileSync(mirror) : undefined
const assertDependencies = () => {
  for (const dependency of dependencies) if (JSON.stringify(captureMetadataPreimages(dirname(dependency.file), [basename(dependency.file)])) !== JSON.stringify(dependency.pins)) throw new Error('MATERIALIZE_DEPENDENCY_CHANGED: ' + basename(dependency.file))
}
assertDependencies()
const document = parse(sourceBytes.toString('utf8'))
if (!Array.isArray(document)) throw new Error('cordis.patch.yml must be a top-level YAML array of patch entries')
// Compatibility mirror is generated, never a second composition source.
const portableRows = document.flatMap(layer => layer.insert ?? []).find(row => row.id === 'preset-ultimate-model')?.config.plugins
if (!Array.isArray(portableRows)) throw new Error('Missing preset-ultimate-model plugins')
const portableMirror = JSON.stringify(portableRows, null, 2) + '\n'

let rewritten = 0, validated = 0
const failures = []
const walkRow = (row, where) => {
  if (row === null || typeof row !== 'object') return
  const localName = typeof row.name === 'object' || (typeof row.name === 'string' && (row.name.startsWith('file:') || isAbsolute(row.name)))
  if (localName) {
    try {
      const expression = typeof row.name === 'object'
      row.name = pathToFileURL(resource(row.name, `${where}/${row.id ?? '?'}`, false)).href
      validated += 1
      if (expression) rewritten += 1
    } catch (error) { failures.push(String(error.message)) }
  }
  const dirs = row.config?.customSkillDirs
  if (dirs !== undefined && !Array.isArray(dirs)) failures.push(`${where}: customSkillDirs must be an array`)
  if (Array.isArray(dirs)) {
    row.config.customSkillDirs = dirs.map((entry, index) => {
      try {
        const value = resource(entry, `${where}/${row.id ?? '?'}/customSkillDirs[${index}]`, true)
        validated += 1
        if (typeof entry === 'object') rewritten += 1
        return value
      } catch (error) { failures.push(String(error.message)); return entry }
    })
  }
  for (const child of row.config?.plugins ?? []) walkRow(child, `${where}/${row.id ?? '?'}`)
}
for (const layer of document) for (const row of layer.insert ?? []) walkRow(row, 'layer')

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, rewritten, failures }, null, 2))
  process.exit(1)
}
if (checkOnly) {
  console.log(JSON.stringify({ ok: true, checkOnly: true, rewritten, validated, packageRoot: resolvedRoot }, null, 2))
} else {
  // JSON is valid YAML and cannot mis-indent a block scalar.
  const text = JSON.stringify(document, null, 2)
  // Re-parse the serialized text, then walk the *result*: leftover `__jsExpr`
  // text alone would also match a string value that merely mentions the word.
  const roundTrip = JSON.parse(text)
  const pending = []
  const findPending = (rows, where) => {
    for (const row of rows ?? []) {
      if (row?.name !== null && typeof row?.name === 'object' && typeof row.name.__jsExpr === 'string') pending.push(`${where}/${row.id ?? '?'}`)
      for (const entry of row?.config?.customSkillDirs ?? []) {
        if (entry !== null && typeof entry === 'object' && typeof entry.__jsExpr === 'string') pending.push(`${where}/${row.id ?? '?'}/customSkillDirs`)
      }
      findPending(row?.config?.plugins, `${where}/${row.id ?? '?'}`)
    }
  }
  for (const layer of roundTrip) findPending(layer.insert, 'layer')
  if (pending.length !== 0) {
    console.error(JSON.stringify({ ok: false, reason: 'expressions remain after materialization', pending }, null, 2))
    process.exit(1)
  }
  // The portable mirror is part of the authenticated distribution. Refuse a
  // stale mirror instead of adding a third cross-directory write to install.
  if (out === join(root, 'cordis.patch.yml') && JSON.stringify(parse(mirrorBytes.toString('utf8'))) !== JSON.stringify(JSON.parse(portableMirror))) throw new Error('TEMPLATE_MIRROR_DRIFT: regenerate and verify the trusted source before installation')
  const outputs = [{ name: plannedNames[0], bytes: Buffer.from(text) }]
  // Keep the integrity manifest honest: if the manifest lists the file we just
  // wrote (or the one we read), rewrite those rows. Otherwise a relocated copy
  // would fail its own self-check for a reason the user cannot act on.
  const manifestPath = join(root, 'FILES.sha256')
  let manifestUpdated = false
  if (existsSync(manifestPath)) {
    const rel = (abs) => relative(root, abs).split(sep).join('/')
    const touched = new Map()
    for (const candidate of [out, source, ...(out === join(root, 'cordis.patch.yml') ? [mirror] : [])]) {
      const key = rel(candidate)
      if (!key.startsWith('..') && existsSync(candidate)) touched.set(key, true)
    }
    const lines = readFileSync(manifestPath, 'utf8').split('\n').filter(Boolean)
    const updated = lines.map((line) => {
      const match = /^(\S.*?)  ([a-f0-9]{64})$/.exec(line)
      if (match === null) return line
      if (!touched.has(match[1])) return line
      manifestUpdated = true
      const inputBytes = match[1] === rel(out) ? Buffer.from(text) : match[1] === rel(source) ? sourceBytes : match[1] === rel(mirror) && mirrorBytes ? mirrorBytes : readFileSync(join(root, match[1]))
      const digest = createHash('sha256').update(inputBytes).digest('hex')
      return match[1] + '  ' + digest
    })
    if (manifestUpdated && out === join(root, 'cordis.patch.yml')) outputs.push({ name: 'FILES.sha256', bytes: Buffer.from(updated.join('\n') + '\n') })
  }
  assertDependencies()
  publishMetadataPair(outputHome, outputs, { preimages, onPhase: assertDependencies })
  console.log(JSON.stringify({ ok: true, out, rewritten, validated, packageRoot: resolvedRoot, bytes: Buffer.byteLength(text), manifestUpdated }, null, 2))
}
