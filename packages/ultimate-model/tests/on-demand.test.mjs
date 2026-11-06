import os from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSkillMetadata } from '../scripts/build-skills-index.mjs'
import { search } from '../scripts/skill-load.mjs'
import { OFFICIAL_SKILLS, officialSkillPath, resolveOfficialResults } from '../scripts/official-skills.mjs'
import { partitionWireTools, replayActivations, namespaceOf } from '../preset/lib/paging.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function fixture(t) {
 const base = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
 const dir = fs.mkdtempSync(path.join(base, 'jizhi-demand-test-')), files = [], dirs = [dir]
 const mkdir = relative => { let at = dir; for (const part of relative.split('/').filter(Boolean)) { at = path.join(at, part); if (!fs.existsSync(at)) { fs.mkdirSync(at); dirs.push(at) } }; return at }
 const file = (relative, text) => { const target = path.join(dir, relative); mkdir(path.dirname(relative)); fs.writeFileSync(target, text); files.push(target); return target }
 t.after(() => { for (const f of files.reverse()) fs.unlinkSync(f); for (const d of dirs.reverse()) fs.rmdirSync(d) })
 return { dir, file, mkdir }
}
test('metadata prefix is bounded, does not score bodies, and malformed headers fail', t => {
 const f = fixture(t), body = 'BODY_ONLY_SENTINEL_' + 'x'.repeat(1024 * 1024)
 const file = f.file('skills/large/SKILL.md', '---\nname: metadata-only\ndescription: match-header\n---\n' + body)
 let read = 0
 assert.deepEqual(readSkillMetadata(file, { onRead: n => { read += n } }), { name: 'metadata-only', description: 'match-header' })
 assert.ok(read > 0 && read <= 512, 'prefix reads must not scale with body length')
 const crlf = f.file('crlf.md', '---\r\nname: 编码\r\ndescription: header\r\n---\r\nbody')
 assert.deepEqual(readSkillMetadata(crlf), { name: '编码', description: 'header' })
 assert.equal(search('BODY_ONLY_SENTINEL', { roots: [['library', path.join(f.dir, 'skills'), 'fixture']] }).length, 0)
 const huge = f.file('too-large.md', '---\nname: ' + 'x'.repeat(17000) + '\n---\n')
 assert.throws(() => readSkillMetadata(huge), /16384/)
 const edgePrefix = '---\nname: edge\ndescription: value\n'
 const edge = f.file('edge.md', edgePrefix + '#'.repeat(512 - Buffer.byteLength(edgePrefix) - 4) + '\n---not-a-marker\n---\nbody')
 assert.throws(() => readSkillMetadata(edge), /mapping/)
 const bad = f.file('bad.md', '---\nname: bad\n')
 assert.throws(() => readSkillMetadata(bad), /closing/)
})
test('all four thin routes are library-only and discoverable, never copied official bodies', () => {
 for (const name of OFFICIAL_SKILLS) {
   const hits = search(name, { bundleRoot: root }).filter(({ e }) => e.name === name)
   assert.equal(hits.length, 1, name)
   assert.equal(hits[0].e.tier, 'library')
   assert.equal(hits[0].e.source, 'bundle.library')
   const text = fs.readFileSync(hits[0].e.path, 'utf8')
   assert.ok(Buffer.byteLength(text) < 1800)
   assert.doesNotMatch(text, /[A-Z]:[\\/]|Deliver a working plugin first|Host plugin export forms/)
 }
})
test('unrelated searches never query Host; official routes resolve only existing declared sources', async t => {
 const f = fixture(t)
 for (const name of OFFICIAL_SKILLS) f.file('official/skills/' + name + '/SKILL.md', 'OFFICIAL_BODY_MUST_NOT_BE_RETURNED')
 let queries = 0
 const signal = new AbortController().signal, agent = { id: 'fixture' }
 const inspect = { list: () => [{ platform: 'host', id: 'Config', methods: [{ name: 'listConfigs' }] }], async query(platform, provider, method, input, actualAgent, actualSignal) {
   queries++; assert.equal(platform, 'host'); assert.equal(provider, 'Config'); assert.equal(method, 'listConfigs'); assert.equal(actualAgent, agent); assert.equal(actualSignal, signal)
   return input.entry ? { packageDir: path.join(f.dir, 'official') } : { entries: [{ id: 'entry-a', name: '@deepseek-ai/dsh-agent-preset', status: 'schema' }], nextOffset: null }
 } }
 const ctx = { get: name => name === 'cordisInspect' ? inspect : undefined }
 const unrelated = search('office', { bundleRoot: root })
 assert.equal(await resolveOfficialResults(unrelated, ctx, { agent, signal }), unrelated)
 assert.equal(queries, 0)
 const routes = search('cordis', { bundleRoot: root })
 const resolved = await resolveOfficialResults(routes, ctx, { agent, signal })
 assert.equal(queries, 2, 'one listing and one entry detail resolves all matching routes')
 const official = resolved.filter(({ e }) => e.source === 'host.official')
 assert.ok(official.length >= 3)
 for (const { e } of official) { assert.ok(e.routePath); assert.ok(e.path.startsWith(f.dir.replaceAll('\\', '/'))); assert.doesNotMatch(JSON.stringify(e), /OFFICIAL_BODY_MUST_NOT_BE_RETURNED/) }
 assert.throws(() => officialSkillPath('relative', 'agent-experience'), /INVALID/)
 assert.throws(() => officialSkillPath(path.join(f.dir, 'official'), '../escape'), /INVALID/)
})
test('missing Host and aborted queries cannot pretend official capability loaded', async () => {
 const routes = search('cordis', { bundleRoot: root })
 const fallback = await resolveOfficialResults(routes, { get: () => undefined })
 assert.ok(fallback.filter(({ e }) => OFFICIAL_SKILLS.includes(e.name)).every(({ e }) => e.source === 'bundle.library' && e.resolution.startsWith('unresolved')))
 const abort = new AbortController(); abort.abort()
 await assert.rejects(resolveOfficialResults(routes, { get: () => { throw Error('should not need source') } }, { signal: abort.signal }))
})
test('Inspect and management definitions are off-wire until successful activation; LRU and error controls hold', () => {
 const patterns = ['cordis_inspect_*', 'plugin_*'], tools = [{ name: 'read' }, { name: 'cordis_inspect_list', description: 'FULL_INSPECT_DEFINITION' }, { name: 'cordis_inspect_query' }, { name: 'plugin_manager', description: 'FULL_MANAGER_DEFINITION' }]
 assert.equal(namespaceOf('plugin_manager', patterns), 'plugin')
 assert.equal(namespaceOf('cordis_inspect_list', patterns), 'cordis_inspect')
 assert.deepEqual(partitionWireTools(tools, patterns, new Set()).resident.map(t => t.name), ['read'])
 const pair = (id, namespace, error = false) => [{ type: 'tool/call', data: { callId: id, name: 'tool_activate', arguments: { namespace } } }, { type: 'tool/result', data: { callId: id, ...(error ? { error: true } : {}) } }]
 const failed = replayActivations(pair('bad', 'plugin', true), 1, patterns)
 assert.deepEqual(failed.active, [])
 const active = replayActivations([...pair('one', 'cordis_inspect'), ...pair('two', 'plugin')], 1, patterns)
 assert.deepEqual(active.active, ['plugin']); assert.deepEqual(active.evicted, ['cordis_inspect'])
 assert.deepEqual(partitionWireTools(tools, patterns, new Set(active.active)).resident.map(t => t.name), ['read', 'plugin_manager'])
})
