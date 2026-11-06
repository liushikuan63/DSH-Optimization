import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'

const tmp = path.resolve(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const relativeToHome = path.relative(os.homedir(), tmp)
if (!relativeToHome || (!relativeToHome.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeToHome))) {
  throw new Error('Set SKILL_INDEX_TEST_TMPDIR to an existing temporary directory outside user home')
}
const fixtures = []
function fixture() {
  const root = fs.mkdtempSync(path.join(tmp, 'jizhi-skill-index-'))
  const directories = [root]
  const files = new Set()
  function dir(relative) {
    const target = path.join(root, relative)
    const missing = []
    for (let p = target; p !== root && !fs.existsSync(p); p = path.dirname(p)) missing.push(p)
    for (const p of missing.reverse()) { fs.mkdirSync(p); directories.push(p) }
    return target
  }
  function file(relative, text) {
    const target = path.join(root, relative)
    dir(path.dirname(relative))
    files.add(target)
    fs.writeFileSync(target, text)
    return target
  }
  function outputs(relative) {
    for (const name of ['skills-index.json', 'INDEX.md']) files.add(path.join(root, relative, name))
  }
  const f = { root, dir, file, outputs }
  fixtures.push({ directories, files })
  return f
}
after(() => {
  // Only known fixture files and empty directories; never recursive rm / rmdir.
  for (const { directories, files } of fixtures.reverse()) {
    for (const file of files) {
      try { fs.unlinkSync(file) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    for (const dir of directories.reverse()) fs.rmdirSync(dir)
  }
})

// Old module-level HOME constants also stay inside a fixture during the red run.
const guard = fixture()
guard.outputs('dsh')
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = guard.dir('dsh')
const { parseFrontmatter, collect, build } = await import('../scripts/build-skills-index.mjs')
if (previousHome === undefined) delete process.env.DSH_HOME
else process.env.DSH_HOME = previousHome
const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts')
const slash = (value) => value.split(path.sep).join('/')
const skill = (name, description = 'fixture keyword') => `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n`
function cli(f, script, args) {
  const home = f.dir('dsh')
  f.outputs('dsh')
  return spawnSync(process.execPath, [path.join(scripts, script), ...args], {
    cwd: f.root,
    encoding: 'utf8',
    env: { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: '' },
  })
}
function snapshot(root) {
  const result = []
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name)
      const stat = fs.statSync(p)
      result.push([path.relative(root, p), stat.mtimeMs, stat.isDirectory() ? 'dir' : fs.readFileSync(p).toString('base64')])
      if (stat.isDirectory()) walk(p)
    }
  }
  walk(root)
  return result
}

test('frontmatter handles BOM, quotes and folded/literal descriptions', () => {
  assert.deepEqual(parseFrontmatter('\uFEFF---\r\nname: "bom-skill"\r\ndescription: >-\r\n  First line\r\n  second line\r\n---\r\n'), {
    name: 'bom-skill', description: 'First line second line',
  })
  assert.equal(parseFrontmatter("---\nname: quoted\ndescription: 'It''s useful' # comment\n---\n").description, "It's useful")
  assert.equal(parseFrontmatter('---\nname: quoted\ndescription: "Use \\"quotes\\" safely"\n---\n').description, 'Use "quotes" safely')
  assert.equal(parseFrontmatter('---\nname: lines\ndescription: |-\n  first\n  second\n---\n').description, 'first second')
  assert.equal(parseFrontmatter('---\nname: quoted\ndescription: "first\n  second"\n---\n').description, 'first second')
})

test('bad frontmatter is rejected rather than becoming an empty description', () => {
  for (const text of [
    '---\nname: bad\ndescription: "unterminated\n---\n',
    '---\nname: bad\ndescription: [not, a, scalar]\n---\n',
    '---\nname: bad\ndescription: one\ndescription: two\n---\n',
    '---\nname: bad\ndescription: missing closer\n',
    '---\nname: bad\ndescription: okay\nmalformed line\n---\n',
  ]) assert.throws(() => parseFrontmatter(text), /frontmatter|description|metadata/i)
})

test('injected userHome discovers .dsh core/library and .agents with source', () => {
  const f = fixture()
  f.file('user/.dsh/skills/core-skill/SKILL.md', skill('core-skill'))
  f.file('user/.dsh/skills-library/lib-skill/SKILL.md', skill('lib-skill'))
  const agentFile = f.file('user/.agents/skills/agent-skill/SKILL.md', skill('agent-skill'))
  const entries = collect({ userHome: f.dir('user'), env: {} })
  assert.deepEqual(entries.map((e) => e.name).sort(), ['agent-skill', 'core-skill', 'lib-skill'])
  const entry = entries.find((e) => e.name === 'agent-skill')
  assert.equal(entry.source, 'user.agents')
  assert.equal(entry.path, slash(agentFile))
  assert.equal(entry.description, 'fixture keyword')
  assert.equal(entry.tier, 'agents')
})

test('DSH_HOME suppresses default user .agents unless DSH_AGENTS_HOME is explicit', () => {
  const f = fixture()
  f.file('user/.agents/skills/hidden/SKILL.md', skill('hidden'))
  f.file('isolated/skills/isolated/SKILL.md', skill('isolated'))
  f.file('explicit-agents/skills/visible/SKILL.md', skill('visible'))
  const options = { userHome: f.dir('user'), env: { DSH_HOME: f.dir('isolated') } }
  assert.deepEqual(collect(options).map((e) => e.name), ['isolated'])
  assert.deepEqual(collect({ ...options, env: { ...options.env, DSH_AGENTS_HOME: f.dir('explicit-agents') } }).map((e) => e.name).sort(), ['isolated', 'visible'])
  assert.deepEqual(collect({ home: f.dir('isolated'), userHome: f.dir('user'), env: {} }).map((e) => e.name), ['isolated'])
})

test('explicit roots retain same-name entries and expose both conflict sources', () => {
  const f = fixture()
  f.file('a/one/SKILL.md', skill('shared'))
  f.file('b/two/SKILL.md', skill('shared'))
  const entries = collect({ roots: [['core', f.dir('a'), 'fixture.a'], { tier: 'library', root: f.dir('b'), source: 'fixture.b' }], env: {} })
  assert.deepEqual(entries.map((e) => e.name), ['shared', 'shared'])
  assert.deepEqual(entries.map((e) => e.source), ['fixture.a', 'fixture.b'])
  assert.deepEqual(entries[0].conflicts.map((e) => e.source), ['fixture.a', 'fixture.b'])
})

test('project roots are opt-in and bundle roots include only packaged mode/core/library/local', () => {
  const f = fixture()
  f.file('user/.dsh/skills/user-skill/SKILL.md', skill('user-skill'))
  f.file('project/.dsh/skills/project-skill/SKILL.md', skill('project-skill'))
  f.file('project/.agents/skills/project-agent/SKILL.md', skill('project-agent'))
  f.file('bundle/skills/core/bundle-core/SKILL.md', skill('bundle-core'))
  f.file('bundle/skills/library/bundle-lib/SKILL.md', skill('bundle-lib'))
  f.file('bundle/skills/local/bundle-local/SKILL.md', skill('bundle-local'))
  f.file('bundle/preset/skills/mode/SKILL.md', skill('bundle-mode'))
  assert.deepEqual(collect({ userHome: f.dir('user'), env: {} }).map((e) => e.name), ['user-skill'])
  assert.deepEqual(collect({ userHome: f.dir('user'), projectRoot: f.dir('project'), env: {} }).map((e) => e.name).sort(), ['project-agent', 'project-skill', 'user-skill'])
  assert.deepEqual(collect({ bundleRoot: f.dir('bundle'), env: { DSH_HOME: f.dir('user/.dsh') } }).map((e) => e.name).sort(), ['bundle-core', 'bundle-lib', 'bundle-local', 'bundle-mode'])
})

test('queries see migration and description edits despite an old index; they never write', () => {
  const f = fixture()
  const oldFile = f.file('dsh/skills/moved/SKILL.md', skill('moved', 'obsolete keyword'))
  f.file('dsh/skills-index.json', JSON.stringify({ entries: [{ name: 'moved', tier: 'core', path: slash(oldFile), description: 'obsolete keyword' }] }))
  assert.equal(cli(f, 'skill-load.mjs', ['obsolete']).status, 0)
  const newFile = f.file('dsh/skills-library/moved/SKILL.md', skill('moved', 'fresh migration keyword'))
  fs.unlinkSync(oldFile)
  const before = snapshot(f.root)
  const result = cli(f, 'skill-load.mjs', ['fresh'])
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.includes(slash(newFile)))
  assert.match(result.stdout, /fresh migration/)
  assert.doesNotMatch(result.stdout, /obsolete/)
  assert.deepEqual(snapshot(f.root), before)
})

test('missing index is not rebuilt by a query and no match exits 3', () => {
  const f = fixture()
  f.file('dsh/skills/fixture/SKILL.md', skill('fixture', 'known keyword'))
  const before = snapshot(f.root)
  const result = cli(f, 'skill-load.mjs', ['absent-unique-token'])
  assert.equal(result.status, 3, result.stderr)
  assert.match(result.stdout, /NO_MATCH/)
  assert.doesNotMatch(result.stdout, /技能库无此项/)
  assert.deepEqual(snapshot(f.root), before)
})

test('metadata errors beat a matching result or no match, exit 2, and write nothing', () => {
  const f = fixture()
  f.file('dsh/skills/good/SKILL.md', skill('good', 'match keyword'))
  f.file('dsh/skills/bad/SKILL.md', '---\nname: bad\ndescription: "broken\n---\n')
  const before = snapshot(f.root)
  for (const q of ['match', 'absent-unique-token']) {
    const result = cli(f, 'skill-load.mjs', [q])
    assert.equal(result.status, 2, result.stdout)
    assert.match(result.stderr, /bad.*SKILL.md/)
    assert.doesNotMatch(result.stdout, /NO_MATCH/)
  }
  assert.deepEqual(snapshot(f.root), before)
})

test('missing required metadata, invalid UTF-8 and SKILL.md IO errors are fatal', () => {
  for (const body of ['# No metadata', '---\nname: bad\n---\n', Buffer.from([0xff, 0xfe])]) {
    const f = fixture()
    f.file('dsh/skills/bad/SKILL.md', body)
    const result = cli(f, 'skill-load.mjs', ['absent'])
    assert.equal(result.status, 2, result.stdout)
    assert.match(result.stderr, /bad.*SKILL.md/)
  }
  const f = fixture()
  f.dir('dsh/skills/bad/SKILL.md')
  const result = cli(f, 'skill-load.mjs', ['absent'])
  assert.equal(result.status, 2, result.stdout)
  assert.match(result.stderr, /SKILL.md/)
})

test('CLI exposes conflicts and supports an explicit .agents root', () => {
  const f = fixture()
  f.file('dsh/skills/shared/SKILL.md', skill('shared'))
  f.file('agents/skills/shared/SKILL.md', skill('shared'))
  const result = cli(f, 'skill-load.mjs', ['--agents-home', f.dir('agents'), 'shared'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /CONFLICT/)
  assert.match(result.stdout, /user\.dsh/)
  assert.match(result.stdout, /user\.agents/)
})

test('bundle CLI query ignores host home and does not create indexes', () => {
  const f = fixture()
  f.file('bundle/preset/skills/mode/SKILL.md', skill('bundle-mode', 'bundle keyword'))
  f.file('dsh/skills/host/SKILL.md', 'bad host metadata')
  const before = snapshot(f.root)
  const result = cli(f, 'skill-load.mjs', ['--bundle-root', f.dir('bundle'), 'bundle-mode'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /bundle\.mode/)
  assert.deepEqual(snapshot(f.root), before)
})

test('invalid CLI input exits 2 before collection or writes', () => {
  const f = fixture()
  f.dir('dsh')
  const before = snapshot(f.root)
  for (const args of [[], ['--unknown'], ['--bundle-root'], ['--home', ''], ['--project-root', path.join(f.root, 'missing'), 'query']]) {
    assert.equal(cli(f, 'skill-load.mjs', args).status, 2)
  }
  assert.deepEqual(snapshot(f.root), before)
})

test('explicit build preserves the interface, --check reports drift read-only, --quiet is quiet', () => {
  const f = fixture()
  f.file('dsh/skills/fixture/SKILL.md', skill('fixture', 'first description'))
  f.outputs('dsh')
  const doc = build({ home: f.dir('dsh'), quiet: true, env: {} })
  assert.equal(doc.count, 1)
  assert.deepEqual(doc.duplicates, [])
  assert.equal(doc.entries[0].source, 'user.dsh')
  assert.match(fs.readFileSync(path.join(f.root, 'dsh/INDEX.md'), 'utf8'), /宿主全量|非宿主/)
  const beforeCheck = snapshot(f.root)
  const check = cli(f, 'build-skills-index.mjs', ['--check', '--quiet'])
  assert.equal(check.status, 0, check.stderr)
  assert.equal(check.stdout, '')
  assert.deepEqual(snapshot(f.root), beforeCheck)
  f.file('dsh/skills/fixture/SKILL.md', skill('fixture', 'changed description'))
  const beforeDrift = snapshot(f.root)
  const drift = cli(f, 'build-skills-index.mjs', ['--check'])
  assert.equal(drift.status, 1, drift.stderr)
  assert.match(drift.stdout, /DRIFT/)
  assert.deepEqual(snapshot(f.root), beforeDrift)
  const rebuilt = cli(f, 'build-skills-index.mjs', ['--quiet'])
  assert.equal(rebuilt.status, 0, rebuilt.stderr)
  assert.equal(rebuilt.stdout, '')
})

test('build validates all skills before touching an existing index', () => {
  const f = fixture()
  f.file('dsh/skills-index.json', 'sentinel json')
  f.file('dsh/INDEX.md', 'sentinel markdown')
  f.file('dsh/skills/bad/SKILL.md', '---\nname: bad\ndescription: []\n---\n')
  const before = snapshot(f.root)
  const result = cli(f, 'build-skills-index.mjs', ['--quiet'])
  assert.equal(result.status, 2, result.stdout)
  assert.deepEqual(snapshot(f.root), before)
})

test('missing check index reports drift without writing and bundle build stays in bundle', () => {
  const f = fixture()
  f.file('dsh/skills/fixture/SKILL.md', skill('fixture'))
  const before = snapshot(f.root)
  assert.equal(cli(f, 'build-skills-index.mjs', ['--check']).status, 1)
  assert.deepEqual(snapshot(f.root), before)
  f.file('bundle/skills/core/example/SKILL.md', skill('example'))
  f.outputs('bundle')
  const result = cli(f, 'build-skills-index.mjs', ['--bundle-root', f.dir('bundle'), '--quiet'])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(f.root, 'dsh/skills-index.json')), false)
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'bundle/skills-index.json'), 'utf8')).count, 1)
})
