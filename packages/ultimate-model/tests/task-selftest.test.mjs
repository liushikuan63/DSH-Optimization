import os from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gradeTask, readLedger, LIMITS } from '../scripts/task-selftest.mjs'
import { search } from '../scripts/skill-load.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const script = path.join(root, 'scripts/task-selftest.mjs')
function ledger() {
  return { schemaVersion: 1, taskType: 'change', scope: 'session-task', revision: 'candidate-1', claim: 'partial',
    checks: [
      { id: 'normal', kind: 'positive', requiredLayer: 'isolated', expected: true },
      { id: 'reject', kind: 'negative', requiredLayer: 'isolated', expected: false },
    ],
    observations: [
      { checkId: 'normal', scope: 'session-task', revision: 'candidate-1', layer: 'isolated', execution: 'completed', actual: true, ref: 'call-normal' },
      { checkId: 'reject', scope: 'session-task', revision: 'candidate-1', layer: 'isolated', execution: 'completed', actual: false, ref: 'call-reject' },
    ] }
}
const cases = [
  ['positive and negative evidence agree', () => {}, 'pass', 'matches'],
  ['missing evidence is not success', l => l.observations.pop(), 'unverified', 'missing-evidence'],
  ['stale revision cannot prove current result', l => { l.observations[0].revision = 'baseline-0' }, 'unverified', 'revision-mismatch'],
  ['foreign scope cannot prove current task', l => { l.observations[0].scope = 'other-task' }, 'unverified', 'scope-mismatch'],
  ['isolated test cannot establish real host', l => { l.checks[0].requiredLayer = 'host' }, 'unverified', 'layer-mismatch'],
  ['host registration cannot establish user path', l => { l.checks[0].requiredLayer = 'user-path'; l.observations[0].layer = 'host' }, 'unverified', 'layer-mismatch'],
  ['static files cannot establish isolated behavior', l => { l.observations[0].layer = 'static' }, 'unverified', 'layer-mismatch'],
  ['wrong outcome fails', l => { l.observations[0].actual = false }, 'fail', 'outcome-mismatch'],
  ['failed execution fails', l => { delete l.observations[0].actual; l.observations[0].execution = 'failed' }, 'fail', 'execution-failed'],
  ['skipped check stays unverified', l => { delete l.observations[0].actual; l.observations[0].execution = 'skipped' }, 'unverified', 'skipped'],
  ['blocked check stays unverified', l => { delete l.observations[0].actual; l.observations[0].execution = 'blocked' }, 'unverified', 'blocked'],
  ['cancelled check stays unverified', l => { delete l.observations[0].actual; l.observations[0].execution = 'cancelled' }, 'unverified', 'cancelled'],
  ['completion claim without evidence fails', l => { l.observations = []; l.claim = 'complete' }, 'fail', 'unsupported-completion'],
  ['blocked task does not turn green', l => { l.claim = 'blocked' }, 'unverified', 'task-stopped'],
  ['cancelled task does not turn green', l => { l.claim = 'cancelled' }, 'unverified', 'task-stopped'],
]
for (const [name, mutate, expected, reason] of cases) test('conversation contract: ' + name, () => {
  const l = ledger(); mutate(l)
  const before = JSON.stringify(l), result = gradeTask(l)
  assert.equal(result.status, expected)
  assert.ok(result.reasons.includes(reason) || result.checks.some(check => check.reason === reason))
  assert.equal(result.provenanceVerified, false)
  assert.equal(result.actionsExecuted, false)
  assert.equal(JSON.stringify(l), before, 'grading must not mutate the supplied ledger')
})

test('read-only tasks need an outcome, not fabricated change tests; false, zero and null compare exactly', () => {
  for (const value of [false, 0, null, 'observed']) {
    const l = ledger(); l.taskType = 'read-only'; l.checks = [l.checks[0]]; l.observations = [l.observations[0]]
    l.checks[0].kind = 'outcome'; l.checks[0].expected = value; l.observations[0].actual = value
    assert.equal(gradeTask(l).status, 'pass')
  }
})

test('malformed plans, zero checks, missing controls and cherry-picked duplicate evidence fail closed', () => {
  const mutations = [
    l => { l.schemaVersion = 2 }, l => { l.approved = true }, l => { l.checks = [] },
    l => { l.checks[1].kind = 'positive' }, l => { l.checks[0].kind = 'negative' },
    l => { l.checks[0].verified = true }, l => { l.checks[0].expected = {} },
    l => { l.checks[1].id = 'normal' }, l => { l.checks[0].requiredLayer = 'guessed' },
    l => l.observations.push({ ...l.observations[0], actual: false }),
    l => { l.observations[0].checkId = 'unknown' }, l => { delete l.observations[0].actual },
    l => { delete l.observations[0].ref }, l => { l.observations[0].ref = '../history' },
    l => { l.observations[0].actual = 'x'.repeat(LIMITS.maxText + 1) },
    l => { l.observations[0].actual = Number.NaN },
    l => { l.observations[0].execution = 'skipped' },
    l => { l.checks = Array(LIMITS.maxChecks + 1).fill(l.checks[0]) },
    l => { l.observations = Array(LIMITS.maxChecks + 1).fill(l.observations[0]) },
  ]
  for (const mutate of mutations) { const l = ledger(); mutate(l); assert.throws(() => gradeTask(l), { message: 'TASK_SELFTEST_INPUT' }) }
  for (const input of [null, [], true]) assert.throws(() => gradeTask(input), { message: 'TASK_SELFTEST_INPUT' })
})

test('reports never echo supplied values, references, scope or labels and never authenticate evidence', () => {
  const l = ledger(); l.scope = 'PRIVATE_SCOPE'; l.checks[0].id = l.observations[0].checkId = 'PRIVATE_LABEL'
  l.checks[0].expected = l.observations[0].actual = 'PRIVATE_VALUE'
  l.observations[0].ref = 'PRIVATE_REFERENCE'
  for (const item of l.observations) item.scope = l.scope
  l.claim = 'complete'
  const report = gradeTask(l)
  assert.equal(report.status, 'pass')
  assert.equal(report.provenanceVerified, false)
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_/)
})

async function fixture(t) {
  const base = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
  const dir = await fs.mkdtemp(path.join(base, 'jizhi-task-selftest-'))
  const files = new Set(), dirs = [dir]
  t.after(async () => {
    for (const file of files) { try { await fs.unlink(file) } catch (e) { if (e.code !== 'ENOENT') throw e } }
    for (const folder of dirs.toReversed()) await fs.rmdir(folder)
  })
  return { dir, files, dirs, async write(name, content) { const file = path.join(dir, name); files.add(file); await fs.writeFile(file, content); return file } }
}
function cli(dir, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', timeout: 10000, windowsHide: true })
  assert.equal(result.error, undefined); assert.equal(result.signal, null)
  return result
}

test('real CLI preserves pass/fail/unverified/input exit codes and does not write results', async t => {
  const f = await fixture(t), l = ledger()
  const file = await f.write('ledger.json', JSON.stringify(l))
  const before = await fs.readFile(file, 'utf8')
  assert.equal(cli(f.dir, '--input=ledger.json').status, 0)
  assert.equal(await fs.readFile(file, 'utf8'), before)
  l.observations[0].actual = false
  await fs.writeFile(file, JSON.stringify(l)); assert.equal(cli(f.dir, '--input=ledger.json').status, 1)
  l.observations = []
  await fs.writeFile(file, JSON.stringify(l)); assert.equal(cli(f.dir, '--input=ledger.json').status, 3)
  await fs.writeFile(file, '{PRIVATE_INVALID_JSON')
  const invalid = cli(f.dir, '--input=ledger.json')
  assert.equal(invalid.status, 2); assert.doesNotMatch(invalid.stderr, /PRIVATE_INVALID_JSON/)
  assert.equal(cli(f.dir).status, 2)
  assert.equal(cli(f.dir, '--input=ledger.json', '--execute').status, 2)
  assert.deepEqual(await fs.readdir(f.dir), ['ledger.json'])
})

test('reader rejects oversized, credential-like and escaping paths without reading history', async t => {
  const f = await fixture(t)
  await f.write('large.json', ' '.repeat(LIMITS.maxBytes + 1))
  for (const input of ['large.json', '../outside.json', '.env', '.dsh/session.json', 'D:/outside.json', 'a\\b.json']) {
    await assert.rejects(readLedger(f.dir, input), { message: 'TASK_SELFTEST_INPUT' })
  }
})

test('reader rejects hardlinks and ancestor junctions using isolated registered fixtures', async t => {
  const f = await fixture(t), file = await f.write('ledger.json', JSON.stringify(ledger()))
  const hard = path.join(f.dir, 'hard.json'); f.files.add(hard); await fs.link(file, hard)
  await assert.rejects(readLedger(f.dir, 'hard.json'), { message: 'TASK_SELFTEST_INPUT' })
  await fs.unlink(hard)
  const alias = path.join(f.dir, 'alias'); f.files.add(alias)
  await fs.symlink(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(readLedger(f.dir, 'alias/ledger.json'), { message: 'TASK_SELFTEST_INPUT' })
})

test('isolated grader mutations are detected, not accepted as successful task evidence', async t => {
  const f = await fixture(t), source = await fs.readFile(script, 'utf8')
  const importAnchor = "from '../plugins/context-checkpoint/store.mjs'"
  assert.ok(source.includes(importAnchor))
  const relocated = source.replace(importAnchor, 'from ' + JSON.stringify(pathToFileURL(path.join(root, 'plugins/context-checkpoint/store.mjs')).href))
  const stale = ledger(); stale.observations[0].revision = 'old'
  const claim = ledger(); claim.observations = []; claim.claim = 'complete'
  const mutations = [
    ["if (observation.revision !== ledger.revision)", stale, 'unverified'],
    ["if (ledger.claim === 'complete' && status !== 'pass')", claim, 'fail'],
  ]
  let detected = 0
  for (const [anchor, l, expected] of mutations) {
    assert.equal(gradeTask(l).status, expected)
    assert.equal(relocated.split(anchor).length, 2, 'mutation must match exactly one production condition')
    const mutant = relocated.replace(anchor, 'if (false)')
    assert.notEqual(mutant, relocated)
    const file = await f.write('mutant-' + detected + '.mjs', mutant)
    const broken = (await import(pathToFileURL(file).href)).gradeTask
    assert.throws(() => assert.equal(broken(l).status, expected), { code: 'ERR_ASSERTION' })
    detected++
  }
  assert.equal(detected, 2)
})

test('existing skill discovery and adaptive checkpoint documentation remain connected (static only)', async () => {
  const hits = search('对话任务自测', { bundleRoot: root }).filter(({ e }) => e.name === 'verify-before-claim')
  assert.equal(hits.length, 1)
  const source = await fs.readFile(path.join(root, 'skills/core/verify-before-claim/references/task-selftest.md'), 'utf8')
  assert.match(source, /## 入口：先按任务与风险分流/)
  assert.match(source, /## 循环控制：证据决定下一格/)
  const names = ['声明核对', '分层取证', '隔离变量', '正负对照', '最小修复', '回归验证']
  let previous = -1
  for (let i = 0; i < names.length; i++) {
    const heading = '## ' + (i + 1) + '. ' + names[i]
    assert.equal(source.split(heading).length, 2)
    const at = source.indexOf(heading); assert.ok(at > previous); previous = at
  }
  const template = JSON.parse(await fs.readFile(path.join(root, 'skills/core/verify-before-claim/templates/task-evidence.json'), 'utf8'))
  assert.equal(gradeTask(template).status, 'unverified', 'an unfilled example must never be green')
})

test('portable runtime guidance requires live discovery and rejects injected author-machine claims (static only)', async () => {
  const text = await fs.readFile(path.join(root, 'skills/core/runtime-truth-verifier/SKILL.md'), 'utf8')
  const check = value => {
    assert.doesNotMatch(value, /mcp-dbhub|本机 PATH 上有/)
    assert.match(value, /现场发现/)
    assert.match(value, /不自行安装或启用/)
  }
  check(text)
  assert.throws(() => check(text + '\n本机 PATH 上有预装客户端，无需现场核对。'), { code: 'ERR_ASSERTION' })
})
