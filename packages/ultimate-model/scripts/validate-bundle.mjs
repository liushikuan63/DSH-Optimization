import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { collect } from './build-skills-index.mjs'
import { resolvePackageExpression } from './package-resource.mjs'
import { validateManifestCoverage } from './distribution.mjs'
import { auditReferences } from './audit-references.mjs'
import { OFFICIAL_SKILLS } from './official-skills.mjs'
const require = createRequire(import.meta.url)
export function validateBundle(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  const yaml = require(path.join(root, 'vendor/js-yaml.js'))
  const pkg = json('package.json'), patch = yaml.load(fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8'))
  assert.equal(pkg.name, '@local/ultimate-model')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.version, json('manifest.json').version)
  assert.ok(!pkg.scripts || !Object.keys(pkg.scripts).some(k => /install|prepare/.test(k)))
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0)
  assert.equal(patch.length, 1)
  assert.deepEqual(Object.keys(patch[0]), ['insert'])
  const declaration = patch[0].insert
  // 2026-10-28：本包已含默认 disabled 的本机记忆行（@local/ultimate-model/local-memory）。
  // 原断言要求整张表恰好三行，于是包自带自检恒红（红久了没人看它）。改为分两段判：
  // 生效行必须恰好三行；未生效行必须只有 local-memory 且确实 disabled。
  assert.deepEqual(declaration.filter(r => r.disabled !== true).map(r => r.id),
    ['preset-ultimate-model', 'ultimate-model-experience-loop', 'ultimate-model-context-checkpoint'],
    'only this optional mode may be declared enabled')
  assert.deepEqual(declaration.filter(r => r.disabled === true).map(r => r.id), ['ultimate-model-local-memory'],
    'the only disabled-by-default row is local-memory')
  const preset = declaration[0], rows = preset.config.plugins
  assert.equal(preset.config.id, 'ultimate-model')
  assert.equal(json('manifest.json').preset, preset.config.id, 'manifest preset must match the loaded composition')
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length, 'duplicate preset row')
  for (const id of ['ultimate-model-context-checkpoint', 'ultimate-model-experience-loop']) {
    const row = declaration.find(r => r.id === id)
    assert.ok(typeof row.name === 'string' || (row.name && typeof row.name.__jsExpr === 'string'), 'bundle plugin names must be literal or a portable expression')
    assert.equal(rows.some(r => r.id === id), false, 'agent observers must remain bundle-level and mode-gated')
  }
  const catalog = rows.find(r => r.id === 'tool-catalog'), activate = rows.find(r => r.id === 'tool-activate')
  assert.deepEqual(catalog.config.pagedToolPatterns, activate.config.pagedToolPatterns)
  assert.equal(catalog.config.maxActiveNamespaces, activate.config.maxActiveNamespaces)
  assert.equal(catalog.config.nativeSummaryOnly, true)
  for (const pattern of ['cordis_inspect_*', 'plugin_*']) assert.ok(catalog.config.pagedToolPatterns.includes(pattern))
  for (const name of ['@deepseek-ai/dsh-tool-cordis', '@deepseek-ai/dsh-plugin-manager/tools']) assert.equal(rows.filter(r => r.name === name).length, 1, name)
  assert.ok(!JSON.stringify(declaration).includes('@deepseek-ai/dsh-tool-cordis/host'), 'do not register a second Host Inspect')
  assert.equal(rows.find(r => r.id === 'tool-ask-user').config.mode, 'legacy')
  assert.ok(!rows.some(r => ['hooks-claude-code', 'ask-user-auto-pick', 'auto-continue-native'].includes(r.id)))
  const template = yaml.load(fs.readFileSync(path.join(root, 'cordis.patch.template.yml'), 'utf8'))
  const portableRows = template[0].insert.find(r => r.id === 'preset-ultimate-model').config.plugins
  assert.deepEqual(yaml.load(fs.readFileSync(path.join(root, 'preset/agent.cordis.yml.tpl'), 'utf8')), portableRows, 'compatibility mirror must be generated from the one template')
  assert.deepEqual(portableRows.find(r => r.id === 'tool-catalog').config.pagedToolPatterns, catalog.config.pagedToolPatterns)
  const baseUrl = pathToFileURL(path.join(root, 'cordis.patch.yml')).href, actualRoot = fs.realpathSync(root)
  const inside = (target, label) => {
    const resolved = fs.realpathSync(target), relative = path.relative(actualRoot, resolved)
    assert.ok(relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)), label + ': outside this package copy')
    return resolved
  }
  const resolveEntry = (entry, label) => {
    if (typeof entry === 'string') { assert.ok(path.isAbsolute(entry), label + ': expected an absolute path'); return inside(entry, label) }
    assert.ok(entry && typeof entry.__jsExpr === 'string', label + ': expected literal or expression')
    return inside(resolvePackageExpression(entry.__jsExpr, root), label)
  }
  // Bundle-level observers are executable entries too; checking only the
  // preset subtree could accept a missing or foreign checkpoint/experience row.
  for (const row of [...declaration, ...rows]) {
    try {
      if (row.name && typeof row.name === 'object') assert.ok(fs.statSync(resolveEntry(row.name, row.id)).isFile())
      if (typeof row.name === 'string' && row.name.startsWith('file:')) assert.ok(fs.statSync(inside(fileURLToPath(row.name), row.id)).isFile())
    } catch (error) { throw new Error('BUNDLE_PLUGIN_ENTRY: ' + row.id, { cause: error }) }
  }
  for (const wrapped of rows.find(r => r.id === 'skill-filesystem').config.customSkillDirs) assert.ok(fs.statSync(resolveEntry(wrapped, 'customSkillDirs')).isDirectory())
  const guard = fs.readFileSync(path.join(root, 'plugins/hook-guards-native/index.js'), 'utf8')
  assert.match(guard, /ctx\.tools\.guard\(/)
  assert.doesNotMatch(guard, /ctx\.on\(['"]tools\/pre-execute/)
  assert.match(fs.readFileSync(path.join(root, 'plugins/context-checkpoint/index.mjs'), 'utf8'), /ctx\.tools\.guard\(/)
  for (const locale of ['en', 'zh']) { const meta = json('locale/' + locale + '.json').meta; assert.ok(meta.title && meta.description) }
  assert.equal(pkg.exports['./icon'], './icon.svg')
  const icon = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8')
  assert.match(icon, /<svg\b/); assert.match(icon, /<\/svg>/); assert.ok(Buffer.byteLength(icon) < 262144)
  assert.equal(json('vendor/package.json').type, 'commonjs')
  const skills = collect({ bundleRoot: root })
  assert.ok(skills.length > 1)
  for (const name of OFFICIAL_SKILLS) {
    const matches = skills.filter(s => s.name === name)
    assert.equal(matches.length, 1, 'missing or duplicated official route ' + name)
    assert.equal(matches[0].tier, 'library')
  }
  const active = JSON.stringify(patch)
  assert.doesNotMatch(active, /__PRESET_DIR__|__SKILLS_DIR__|__HOOKS_JSON__/)
  for (const match of active.matchAll(/[A-Za-z]:\\\\[^"']+|file:\/\/\/[^"']+/g)) {
    const raw = match[0].replace(/\\\\/g, '\\')
    inside(raw.startsWith('file:') ? fileURLToPath(raw) : raw, 'patch path')
  }
  const references = auditReferences(root)
  const hashes = fs.readFileSync(path.join(root, 'FILES.sha256'), 'utf8').trim().split(/\r?\n/), seen = new Set()
  for (const line of hashes) {
    const match = /^(\S.*?)  ([a-f0-9]{64})$/.exec(line)
    assert.ok(match, 'invalid hash line')
    const [, relative, expected] = match
    assert.ok(!path.isAbsolute(relative) && !relative.split('/').includes('..') && !relative.includes('\\') && relative !== 'FILES.sha256')
    assert.ok(!seen.has(relative), 'duplicate hash entry'); seen.add(relative)
    const full = path.join(root, relative), info = fs.lstatSync(full)
    assert.ok(info.isFile() && !info.isSymbolicLink(), 'unexpected hash target')
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'), expected, relative + ' integrity mismatch')
  }
  assert.ok(seen.has('package.json') && seen.has('plugins/context-checkpoint/index.mjs') && seen.has('RESTORE.md'))
  validateManifestCoverage(root, seen)
  return { ok: true, preset: 'ultimate-model', version: pkg.version, pluginRows: rows.length, bundledSkills: skills.length, manifestFiles: seen.size, references, scope: 'static-filesystem', note: 'Not live host or model-wire verification.' }
}
