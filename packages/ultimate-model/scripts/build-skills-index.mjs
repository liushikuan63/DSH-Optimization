// 仅显式 build 才写索引；collect / --check 均只读。仅使用 Node 内置模块。
// node build-skills-index.mjs [--quiet] [--check] [--home <dir>]
//   [--agents-home <.agents-dir>] [--project | --project-root <dir>] [--bundle-root <dir>]
// --check: 0=一致，1=漂移，2=输入、元数据或 IO 错误；计数不是宿主全量 catalog。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { captureMetadataPreimages, publishMetadataPair } from './metadata-transaction.mjs'

const slash = (value) => value.split(path.sep).join('/')
const compact = (value) => value.replace(/\s+/g, ' ').trim()
const metadataError = (message) => new Error(`Invalid frontmatter metadata: ${message}`)

function scalar(value, key) {
  value = value.trim()
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0]
    let end = -1
    for (let i = 1; i < value.length; i++) {
      if (quote === '"' && value[i] === '\\') { i++; continue }
      if (value[i] !== quote) continue
      if (quote === "'" && value[i + 1] === "'") { i++; continue }
      end = i
      break
    }
    if (end < 0 || !/^(?:\s*#.*)?$/.test(value.slice(end + 1))) throw metadataError(`${key}: invalid quoted scalar`)
    if (quote === "'") return value.slice(1, end).replace(/''/g, "'")
    try { return JSON.parse(value.slice(0, end + 1)) } catch { throw metadataError(`${key}: invalid quoted escape`) }
  }
  value = value.replace(/\s+#.*$/, '').trim()
  if (['name', 'description'].includes(key) && (
    /^[\[\]{},&*!|>@`]/.test(value) || /:\s/.test(value) || /^(?:null|~|true|false|[-+]?\d+(?:\.\d+)?)$/i.test(value)
  )) throw metadataError(`${key}: expected a string scalar (quote special values)`)
  return value
}

// A dependency-free frontmatter scalar reader, not a general YAML loader.
// Nested extension metadata is ignored; name/description must be string scalars.
// Description whitespace is flattened for the existing index/search interface.
export function parseFrontmatter(text) {
  if (typeof text !== 'string') throw metadataError('expected text')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (!/^---[ \t]*$/.test(lines[0])) return {}
  const end = lines.findIndex((line, i) => i > 0 && /^---[ \t]*$/.test(line))
  if (end < 0) throw metadataError('missing closing ---')
  const out = {}
  for (let i = 1; i < end; i++) {
    if (!lines[i].trim() || /^\s*#/.test(lines[i])) continue
    const match = lines[i].match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/)
    if (!match) throw metadataError(`invalid mapping at line ${i + 1}`)
    const [, key, initial] = match
    if (Object.hasOwn(out, key)) throw metadataError(`duplicate ${key}`)
    const continuation = []
    while (i + 1 < end && (!lines[i + 1].trim() || /^[ \t]/.test(lines[i + 1]))) continuation.push(lines[++i])
    let value = initial.trim()
    if (/^[|>][+-]?(?:\s+#.*)?$/.test(value)) {
      value = compact(continuation.map((line) => line.trim()).join(' '))
    } else if (!value && continuation.some((line) => line.trim())) {
      if (['name', 'description'].includes(key)) throw metadataError(`${key}: expected a string, not nested metadata`)
      value = ''
    } else {
      value = scalar([value, ...continuation.filter((line) => line.trim() && !/^\s*#/.test(line)).map((line) => line.trim())].join(' '), key)
    }
    // Avoid __proto__ assignment and preserve the ordinary-object return API.
    Object.defineProperty(out, key, { value, enumerable: true, configurable: true, writable: true })
  }
  return out
}

// Read a bounded prefix, parse only frontmatter, and never score skill bodies.
// Prefix reads can include adjacent bytes; they are neither returned nor loaded as instructions.
export function readSkillMetadata(file, { onRead } = {}) {
  const fd = fs.openSync(file, 'r')
  const chunks = [], chunk = Buffer.alloc(512), maxBytes = 16384
  let total = 0
  try {
    while (total < maxBytes) {
      const size = fs.readSync(fd, chunk, 0, Math.min(chunk.length, maxBytes - total), total)
      if (size > 0) { chunks.push(Buffer.from(chunk.subarray(0, size))); total += size; onRead?.(size) }
      const bytes = Buffer.concat(chunks), text = bytes.toString('utf8'), first = text.indexOf('\n')
      if (first >= 0) {
        if (!/^\uFEFF?---[ \t]*\r?$/.test(text.slice(0, first))) return {}
        const tail = text.slice(first + 1)
        const complete = size === 0 ? tail : tail.slice(0, tail.lastIndexOf('\n') + 1)
        const end = /^---[ \t]*\r?$/m.exec(complete)
        if (end) {
          const header = text.slice(0, first + 1 + end.index + end[0].length)
          return parseFrontmatter(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, Buffer.byteLength(header))) + '\n')
        }
      }
      if (size === 0) throw metadataError('missing closing ---')
    }
    throw metadataError('frontmatter exceeds 16384 bytes')
  } finally { fs.closeSync(fd) }
}

function directory(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}: expected a nonempty directory`)
  return path.resolve(value)
}
function requireDirectory(value, label) {
  const root = directory(value, label)
  if (!fs.statSync(root).isDirectory()) throw new Error(`${label}: not a directory: ${root}`)
  return root
}

// home means DSH home, userHome means the OS user directory; roots overrides all defaults.
// roots accepts [tier, root, source?] or { tier, root, source?, optional? } entries.
// Explicit home / DSH_HOME disables real-user .agents fallback. DSH_AGENTS_HOME
// (or agentsHome) opts it back in, and always names the .agents directory itself.
function resolveRoots(options) {
  const env = options.env ?? process.env
  if (options.roots !== undefined) {
    if (!Array.isArray(options.roots)) throw new Error('roots must be an array')
    return options.roots.map((item) => {
      const spec = Array.isArray(item) ? { tier: item[0], root: item[1], source: item[2] } : item
      if (!spec || typeof spec.tier !== 'string' || !spec.tier.trim()) throw new Error('root tier is required')
      const root = directory(spec.root, 'root')
      return { tier: spec.tier, root, source: spec.source || `${spec.tier}:${slash(root)}`, optional: spec.optional === true }
    })
  }
  const roots = []
  const add = (tier, root, source) => roots.push({ tier, root, source, optional: true })
  if (options.bundleRoot !== undefined) {
    if (options.projectRoot !== undefined || options.agentsHome !== undefined) throw new Error('--bundle-root cannot be combined with project/agents roots')
    const root = requireDirectory(options.bundleRoot, 'bundleRoot')
    add('core', path.join(root, 'skills', 'core'), 'bundle.core')
    add('library', path.join(root, 'skills', 'library'), 'bundle.library')
    add('local', path.join(root, 'skills', 'local'), 'bundle.local')
    add('mode', path.join(root, 'preset', 'skills'), 'bundle.mode')
    return roots
  }
  const userHome = directory(options.userHome ?? os.homedir(), 'userHome')
  const home = directory(options.home ?? (env.DSH_HOME || path.join(userHome, '.dsh')), 'home')
  add('core', path.join(home, 'skills'), 'user.dsh')
  add('library', path.join(home, 'skills-library'), 'user.dsh')
  const isolated = options.home !== undefined || Boolean(env.DSH_HOME)
  const agentsHome = options.agentsHome ?? (env.DSH_AGENTS_HOME || (isolated ? undefined : path.join(userHome, '.agents')))
  if (agentsHome !== undefined) add('agents', path.join(directory(agentsHome, 'agentsHome'), 'skills'), 'user.agents')
  if (options.projectRoot !== undefined) {
    const root = requireDirectory(options.projectRoot, 'projectRoot')
    add('core', path.join(root, '.dsh', 'skills'), 'project.dsh')
    add('library', path.join(root, '.dsh', 'skills-library'), 'project.dsh')
    add('agents', path.join(root, '.agents', 'skills'), 'project.agents')
  }
  return roots
}

function collectRoots(roots) {
  const entries = []
  const seenPaths = new Set()
  for (const { tier, root, source, optional } of roots) {
    let children
    try { children = fs.readdirSync(root, { withFileTypes: true }) } catch (error) {
      if (optional && error.code === 'ENOENT') {
        // A dangling root symlink is an IO failure, not an absent optional root.
        try { fs.lstatSync(root) } catch (missing) { if (missing.code === 'ENOENT') continue; throw missing }
      }
      throw new Error(`${source} ${root}: ${error.message}`, { cause: error })
    }
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      const dir = path.join(root, child.name)
      if (!child.isDirectory() && !child.isSymbolicLink()) continue
      if (child.isSymbolicLink() && !fs.statSync(dir).isDirectory()) continue
      const file = path.join(dir, 'SKILL.md')
      const identity = process.platform === 'win32' ? file.toLowerCase() : file
      if (seenPaths.has(identity)) continue
      try { fs.lstatSync(file) } catch (error) {
        if (error.code === 'ENOENT') continue
        throw new Error(`${source} ${file}: ${error.message}`, { cause: error })
      }
      try {
        const fm = readSkillMetadata(file)
        for (const key of ['name', 'description']) {
          if (typeof fm[key] !== 'string' || !fm[key].trim()) throw metadataError(`missing or empty ${key}`)
        }
        if (/[\r\n/\\]/.test(fm.name)) throw metadataError('name must be a single path-free scalar')
        entries.push({ name: fm.name.trim(), tier, path: slash(file), description: compact(fm.description), source, root: slash(root), directory: child.name })
        seenPaths.add(identity)
      } catch (error) { throw new Error(`${source} ${file}: ${error.message}`, { cause: error }) }
    }
  }
  const rank = { core: 0, library: 1, agents: 2, mode: 3 }
  entries.sort((a, b) => (rank[a.tier] ?? 4) - (rank[b.tier] ?? 4) || a.name.localeCompare(b.name) || a.source.localeCompare(b.source) || a.path.localeCompare(b.path))
  const groups = new Map()
  for (const entry of entries) {
    if (!groups.has(entry.name)) groups.set(entry.name, [])
    groups.get(entry.name).push(entry)
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const sources = group.map(({ source, tier, path }) => ({ source, tier, path }))
    for (const entry of group) entry.conflicts = sources
  }
  return entries
}

export function collect(options = {}) {
  return collectRoots(resolveRoots(options))
}

const scopeNote = '仅统计所扫描文件系统根；不是宿主全量 catalog，也不证明当前会话已装载。'
const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ')
function markdown(doc) {
  return [
    '# 技能文件系统索引', '', scopeNote, '',
    `生成时间：${doc.generated_at}`, `扫描条目：${doc.count}`, '',
    ...doc.scope.roots.map((root) => `- ${root.source} [${root.tier}]: ${root.root}`), '',
    '| 技能 | 层 | 来源 | 一句话 | 路径 |', '|---|---|---|---|---|',
    ...doc.entries.map((e) => `| ${cell(e.name)} | ${cell(e.tier)} | ${cell(e.source)} | ${cell(e.description).slice(0, 160)} | ${cell(e.path)} |`), '',
    ...doc.conflicts.map((c) => `CONFLICT ${c.name}: ${c.sources.map((s) => `${s.source} ${s.path}`).join(' ; ')}`), '',
    '查询实时采集，不依赖此快照；使用 skill-load.mjs，命中后 read 对应 SKILL.md。', '',
  ].join('\n')
}

export function renderBuildDocument(doc) {
  return [{ name: 'skills-index.json', bytes: Buffer.from(JSON.stringify(doc, null, 1)) }, { name: 'INDEX.md', bytes: Buffer.from(markdown(doc)) }]
}
export function planBuild(options = {}) {
  // Validate the complete collection before creating directories or touching output.
  const roots = resolveRoots(options)
  const entries = collectRoots(roots)
  const conflicts = entries.filter((e) => e.conflicts && entries.find((other) => other.name === e.name) === e)
    .map((e) => ({ name: e.name, sources: e.conflicts }))
  const doc = {
    generated_at: new Date().toISOString(), count: entries.length,
    duplicates: conflicts.map((c) => c.name), conflicts, entries,
    scope: { kind: options.bundleRoot !== undefined ? 'bundle' : 'filesystem', note: scopeNote, roots: roots.map(({ tier, root, source }) => ({ tier, root: slash(root), source })) },
  }
  const env = options.env ?? process.env
  const output = directory(options.home ?? options.bundleRoot ?? (env.DSH_HOME || path.join(options.userHome ?? os.homedir(), '.dsh')), 'output home')
  const extra = options.additionalOutputs ?? []
  if (!Array.isArray(extra)) throw new Error('additionalOutputs must be an array')
  return { doc, outputHome: output, outputs: renderBuildDocument(doc), additionalOutputs: extra,
    preimages: captureMetadataPreimages(output, ['skills-index.json', 'INDEX.md', ...extra.map(item => item.name)]) }
}

export function build(options = {}) {
  const { quiet = false, check = false } = options
  const plan = planBuild(options)
  const { doc, outputHome: output } = plan
  const outJson = path.join(output, 'skills-index.json'), outMd = path.join(output, 'INDEX.md')
  if (options.dryRun) return plan
  if (check) {
    const drift = []
    let recorded
    try { recorded = JSON.parse(fs.readFileSync(outJson, 'utf8').replace(/^\uFEFF/, '')) } catch (error) {
      if (error.code === 'ENOENT') drift.push('skills-index.json missing')
      else throw new Error(`${outJson}: ${error.message}`, { cause: error })
    }
    if (recorded) {
      for (const key of ['count', 'duplicates', 'conflicts', 'entries', 'scope']) {
        if (JSON.stringify(recorded[key]) !== JSON.stringify(doc[key])) drift.push(`${key} changed`)
      }
      if (typeof recorded.generated_at !== 'string') drift.push('generated_at missing')
    } else if (!drift.length) throw new Error(`${outJson}: invalid index object`)
    try {
      const md = fs.readFileSync(outMd, 'utf8')
      if (recorded && md !== markdown({ ...doc, generated_at: recorded.generated_at })) drift.push('INDEX.md changed')
    } catch (error) {
      if (error.code === 'ENOENT') drift.push('INDEX.md missing')
      else throw new Error(`${outMd}: ${error.message}`, { cause: error })
    }
    if (!quiet) console.log(drift.length ? `DRIFT: ${drift.join('; ')}` : `OK: ${doc.count} scanned filesystem entries (not host catalog)`)
    return { ...doc, check: true, drift }
  }
  publishMetadataPair(output, plan.outputs, { ...options.transactionOptions, additionalOutputs: plan.additionalOutputs, preimages: options.preimages ?? plan.preimages })
  if (!quiet) {
    console.log(`index=${doc.entries.length} core=${doc.entries.filter((e) => e.tier === 'core').length} library=${doc.entries.filter((e) => e.tier === 'library').length}`)
    console.log(scopeNote)
    for (const conflict of doc.conflicts) console.log(`CONFLICT ${conflict.name}: ${conflict.sources.map((s) => `${s.source} ${s.path}`).join(' ; ')}`)
    console.log(outJson)
  }
  return doc
}

// Shared CLI grammar: callers never reinterpret unknown flags as query words.
export function parseCli(args, { query = false } = {}) {
  const options = {}
  const terms = []
  const values = { '--home': 'home', '--agents-home': 'agentsHome', '--bundle-root': 'bundleRoot', '--project-root': 'projectRoot' }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--') { terms.push(...args.slice(i + 1)); break }
    if (Object.hasOwn(values, arg)) {
      if (!args[i + 1]?.trim() || args[i + 1].startsWith('--')) throw new Error(`${arg} requires a directory`)
      options[values[arg]] = args[++i]
    } else if (arg === '--quiet') options.quiet = true
    else if (arg === '--check' && !query) options.check = true
    else if (arg === '--project') options.projectRoot = process.cwd()
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`)
    else terms.push(arg)
  }
  if (!query && terms.length) throw new Error(`Unexpected arguments: ${terms.join(' ')}`)
  return { options, terms }
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) {
  try {
    const { options } = parseCli(process.argv.slice(2))
    const doc = build(options)
    process.exitCode = options.check && doc.drift.length ? 1 : 0
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    process.exitCode = 2
  }
}
