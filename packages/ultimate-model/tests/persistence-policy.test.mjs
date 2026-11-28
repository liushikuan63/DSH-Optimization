import os from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const pack = fileURLToPath(new URL('..', import.meta.url))
const { apply: contextApply } = await import(pathToFileURL(path.join(pack, 'plugins/context-checkpoint/index.mjs')))
const { apply: experienceApply } = await import(pathToFileURL(path.join(pack, 'plugins/experience-loop/index.mjs')))
const { apply: localMemoryApply } = await import(pathToFileURL(path.join(pack, 'plugins/local-memory/index.mjs')))
const { runEffect } = await import(pathToFileURL(path.join(pack, 'tests/effect-harness.mjs')))

async function fixture(t, apply, { mode = 'read-only', text = '请实施本任务修复并保存工作状态', policyThrows = false, origin } = {}) {
  const root = await fs.mkdtemp(path.join((process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir()), 'dsh-persistence-repair-'))
  const id = 'session-policy-test'
  const events = [
    { type: 'user/message', seq: 0, time: Date.now(), data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } },
    { type: 'tool/call', seq: 1, time: Date.now(), data: { turn: 1, step: 1, callId: 'fixture-read', name: 'read', arguments: '{}' } },
    { type: 'tool/result', seq: 2, time: Date.now(), surfaceOp: 'append', sourceEventSeqs: [1], data: { turn: 1, step: 1, message: { role: 'tool', source: { kind: 'tool', callId: 'fixture-read' }, toolCallId: 'fixture-read', isError: false, content: [{ type: 'text', text: 'fixture read completed' }] } } },
  ]
  const session = { id, header: { id, cwd: root, isSeeded: false, ...(origin ? { origin } : {}) }, inheritedEventCount: 0, firstLiveSeq: 0, get seq() { return events.length }, isOwnSeq: () => true, surface: { replaceGeneration: 0, nodes: [] } }
  const tools = new Map(), guards = new Set(), rootEvents = new Map(), scopedEvents = new Map(), effects = []
  const add = (map, name, handler) => { const set = map.get(name) || new Set(); map.set(name, set); set.add(handler); return () => { set.delete(handler); if (!set.size) map.delete(name) } }
  const emit = async (map, name, ...args) => { for (const f of [...(map.get(name) || [])]) await f(...args) }
  const toolService = { register: tool => { tools.set(tool.name, tool); return () => tools.delete(tool.name) }, guard: guard => { guards.add(guard); return () => guards.delete(guard) }, restrict: () => () => {} }
  const prompt = { section: () => () => {} }
  const scoped = { tools: toolService, systemPrompt: prompt, on: (name, handler) => add(scopedEvents, name, handler) }
  const agent = { id, session, ctx: scoped }
  const services = {
    agentPresets: { composedPreset: () => 'ultimate-model' },
    agents: { get: key => key === id ? agent : undefined },
    sandboxPolicy: { resolve: ({ session: supplied }) => { assert.equal(supplied, session); if (policyThrows) throw Error('policy unavailable'); return { mode, workspaceRoot: root, sessionId: id } } },
    sessionQuery: { observeSession: async key => { assert.equal(key, id); return { source: 'live', header: session.header, inheritedEventCount: 0, events: events.slice(), cursor: events.length - 1, [Symbol.dispose]() {} } } },
  }
  scoped.get = name => services[name]
  const ctx = { tools: toolService, systemPrompt: prompt, get: name => services[name], on: (name, handler) => add(rootEvents, name, handler), effect: fn => { const dispose = runEffect(fn); effects.push(dispose); return dispose } }
  apply(ctx)
  await emit(rootEvents, 'agent/created', { agent, source: 'startup', signal: new AbortController().signal })
  const exists = async () => { try { return (await fs.readdir(root)).includes('.dsh') } catch { return false } }
  t.after(async () => {
    for (const dispose of effects.toReversed()) dispose()
    // Remove only named files inside this registered, isolated fixture; never recursive delete.
    const sha = (await import('node:crypto')).createHash('sha256').update(id).digest('hex')
    const dirs = [path.join(root, '.dsh', 'jizhi-context', sha), path.join(root, '.dsh', 'jizhi-context'), path.join(root, '.dsh', 'jizhi-experience'), path.join(root, '.dsh', 'local-memory'), path.join(root, '.dsh'), root]
    for (const dir of dirs) {
      for (const leaf of ['checkpoint-v1.json', 'previous-v1.json', 'checkpoint-v1.tmp', 'previous-v1.tmp', 'store-v1.json', 'rollback-v1.json', 'store-v1.tmp', 'rollback-v1.tmp', 'store-v1.lock', 'write.lock']) {
        try { await fs.unlink(path.join(dir, leaf)) } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e }
      }
      try { await fs.rmdir(dir) } catch (e) { if (e.code !== 'ENOENT') throw e }
    }
  })
  return { tools, agent, exists, events, services, dispose() { for (const dispose of effects.toReversed()) dispose() }, async stop() { await emit(scopedEvents, 'agent/turn-stopping', { turn: 1, signal: new AbortController().signal }) }, async call(name, action) { return tools.get(name).execute({ request: JSON.stringify(action) }, { agent, signal: new AbortController().signal }) } }
}
for (const text of [
  'Only answer questions this turn; describe the read-only API; save a checkpoint.',
  'Only answer questions this turn. Describe the read-only API. Save a checkpoint.',
  'Only answer questions this turn\nDescribe the read-only API\nSave a checkpoint.',
]) test('local_memory: postposed current-turn scope prevents actual store mutation: ' + text, async t => {
  const f = await fixture(t, localMemoryApply, { mode: 'workspace-write', text })
  assert.equal((await f.call('local_memory', { action: 'health' })).exists, false)
  await assert.rejects(f.call('local_memory', { action: 'remember', title: 'fixture', body: 'isolated fixture', kind: 'note' }), /LOCAL_MEMORY_PERSISTENCE_DENIED/)
  await assert.rejects(f.call('local_memory', { action: 'forget', id: 'missing', expectedRevision: 1 }), /LOCAL_MEMORY_PERSISTENCE_DENIED/)
  assert.equal(await f.exists(), false)
})
for (const [name, apply] of [['jizhi_context', contextApply], ['jizhi_experience', experienceApply]]) {
  test(name + ': host read-only prevents automatic derived directories and files', async t => {
    const f = await fixture(t, apply)
    assert.equal(await f.exists(), false)
    await f.stop()
    assert.equal(await f.exists(), false, 'turn-stopping may not bypass the host read-only policy')
  })
  test(name + ': explicit mutation is refused before creating any store in read-only mode', async t => {
    const f = await fixture(t, apply)
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    await assert.rejects(f.call(name, action), /READ_ONLY|PERSISTENCE_DENIED/)
    assert.equal(await f.exists(), false)
  })
  test(name + ': mutation control actions cannot bypass read-only policy', async t => {
    const f = await fixture(t, apply)
    for (const action of ['disable', 'rollback']) await assert.rejects(f.call(name, { action }), /READ_ONLY|PERSISTENCE_DENIED/)
    assert.equal(await f.exists(), false)
  })
  test(name + ': inspect/restore/query remain pure reads without a store', async t => {
    const f = await fixture(t, apply)
    for (const action of (name === 'jizhi_context' ? ['inspect', 'restore'] : ['query'])) await f.call(name, { action })
    assert.equal(await f.exists(), false)
  })
  test(name + ': unavailable host policy fails closed for automatic persistence', async t => {
    const f = await fixture(t, apply, { policyThrows: true })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  test(name + ': explicit read-only audit scope also inhibits writes under Full', async t => {
    const f = await fixture(t, apply, { mode: 'danger-full-access', text: '此次仅做只读审阅与提出建议，不执行修改；不创建或更新派生存储。' })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  for (const text of ['只读审阅配置', '请只读审查插件配置', '只读检查，不执行任何修改', 'Read-only inspection of plugin config', '本次只看代码，不落盘', '不要落盘', '不写盘', '不得写盘', 'do not write to disk']) test(name + ': Full does not override ordinary human read-only wording: ' + text, async t => {
    const f = await fixture(t, apply, { mode: 'danger-full-access', text })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  for (const text of [
    '请解释 read-only API 的作用，然后修复实现，并保存本任务检查点。',
    '接口采用只读属性；请修复序列化实现并保存检查点。',
  ]) {
    test(name + ': object description permits automatic persistence and pure reads in a writable main session: ' + text, async t => {
      const f = await fixture(t, apply, { mode: 'workspace-write', text })
      const readAction = name === 'jizhi_context' ? 'inspect' : 'query'
      const before = JSON.parse((await f.call(name, { action: readAction })).text)
      assert.equal(name === 'jizhi_context' ? before.checkpoints.length : before.revision, 0)
      assert.equal(await f.exists(), false, 'reading an absent fixture store must not create it')
      await f.stop()
      const after = JSON.parse((await f.call(name, { action: readAction })).text)
      if (name === 'jizhi_context') {
        assert.equal(after.checkpoints.length, 1)
        assert.equal(JSON.parse((await f.call(name, { action: 'restore' })).text).found, true)
      } else {
        assert.equal(after.revision, 1)
        assert.equal(after.observations.length, 1)
      }
      assert.equal(await f.exists(), true)
    })
    test(name + ': object description permits explicit fixture mutation and readback: ' + text, async t => {
      const f = await fixture(t, apply, { mode: 'workspace-write', text })
      const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
      const result = JSON.parse((await f.call(name, action)).text)
      if (name === 'jizhi_context') {
        assert.equal(typeof result.checkpoint, 'string')
        const restored = JSON.parse((await f.call(name, { action: 'restore' })).text)
        assert.equal(restored.found, true)
        assert.equal(restored.note.objective, '本轮工作')
      } else {
        assert.equal(result.addedObservations, 1)
        const queried = JSON.parse((await f.call(name, { action: 'query' })).text)
        assert.equal(queried.revision, 1)
        assert.equal(queried.observations.length, 1)
      }
      assert.equal(await f.exists(), true)
    })
    test(name + ': object description cannot bypass host read-only or child scope: ' + text, async t => {
      for (const scope of [{ mode: 'read-only' }, { mode: 'workspace-write', origin: 'subagent' }]) {
        const f = await fixture(t, apply, { ...scope, text })
        await f.stop()
        const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
        await assert.rejects(f.call(name, action), /READ_ONLY|PERSISTENCE_DENIED/)
        for (const action of (name === 'jizhi_context' ? ['inspect', 'restore'] : ['query'])) await f.call(name, { action })
        assert.equal(await f.exists(), false)
      }
    })
    test(name + ': object description preserves an earlier human restriction: ' + text, async t => {
      for (const restriction of ['此次仅做只读审阅', '不落盘', '不要创建或更新派生存储']) {
        const f = await fixture(t, apply, { mode: 'workspace-write', text: restriction })
        f.events.push({ type: 'user/message', seq: f.events.length, time: Date.now(), data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } })
        await f.stop()
        const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
        await assert.rejects(f.call(name, action), /PERSISTENCE_DENIED/)
        assert.equal(await f.exists(), false)
      }
    })
  }
  test(name + ': a second real restriction still blocks automatic and explicit persistence after a description', async t => {
    for (const text of [
      '请解释 read-only API 的作用，然后修复实现，并保存本任务检查点。本次仅只读API。',
      '请解释 read-only API 的作用；请只读审查 read-only API。',
      '本次仅回答问题，解释 read-only API 的作用。',
      '本次仅回答问题。\n请解释 read-only API 的作用。',
      '本轮仅做说明；接口采用只读属性。',
      '请解释 read-only API 的作用；全程仅做说明。',
      'For this turn, only answer questions.\nDescribe the read-only API.',
      'Explain the read-only API; only answer questions for this turn.',
      'Explain the read-only API; only answer questions during this round.',
      'For this turn.\nOnly answer questions.\nDescribe the read-only API.',
      'For this turn. Only answer questions. Describe the read-only API.',
      'Only answer questions.\nDescribe the read-only API. For this turn.',
      '全程仅做说明，接口采用只读属性。',
      'For this turn only, explain the read-only API.',
      'Explain the read-only API; read-only review of the implementation.',
      'Describe the read-only field; read-only audit of the serializer.',
      '接口采用只读属性；请修复序列化实现并保存检查点。不创建或更新派生存储。',
      '接口采用只读属性；请修复序列化实现并保存检查点。不落盘。',
    ]) {
      const f = await fixture(t, apply, { mode: 'workspace-write', text })
      await f.stop()
      const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
      await assert.rejects(f.call(name, action), /PERSISTENCE_DENIED/)
      assert.equal(await f.exists(), false)
    }
  })
  test(name + ': postposed current-turn scope blocks automatic and explicit persistence', async t => {
    for (const text of [
      'Only answer questions this turn; describe the read-only API; save a checkpoint.',
      'Only answer questions this turn. Describe the read-only API. Save a checkpoint.',
      'Only answer questions this turn\nDescribe the read-only API\nSave a checkpoint.',
    ]) {
      const f = await fixture(t, apply, { mode: 'workspace-write', text })
      await f.stop()
      assert.equal(await f.exists(), false, text)
      const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
      await assert.rejects(f.call(name, action), /PERSISTENCE_DENIED/, text)
      assert.equal(await f.exists(), false)
    }
  })
  test(name + ': historical only-answer description does not block the current writable task', async t => {
    const text = 'The previous request was to only answer questions this turn; describe the read-only API; save a checkpoint.'
    const f = await fixture(t, apply, { mode: 'workspace-write', text })
    await f.stop()
    assert.equal(await f.exists(), true)
  })
  test(name + ': delegated child does not treat inherited Full as permission for private derived storage', async t => {
    const f = await fixture(t, apply, { mode: 'danger-full-access', origin: 'subagent', text: '分析当前任务并返回结论' })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  test(name + ': a direct human may explicitly authorize child derived storage without changing host policy', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write', origin: 'subagent', text: '允许保存本任务状态' })
    await f.stop()
    assert.equal(await f.exists(), true)
  })
  test(name + ': changing to read-only after the initial policy check is rejected before store creation', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    let readOnly = false, checks = 0
    f.services.sandboxPolicy.resolve = () => { checks++; if (checks === 1) queueMicrotask(() => { readOnly = true }); return { mode: readOnly ? 'read-only' : 'workspace-write' } }
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    await assert.rejects(f.call(name, action), /PERSISTENCE_DENIED/)
    assert.equal(readOnly, true)
    assert.ok(checks >= 2, 'policy must be rechecked inside the write transaction')
    assert.equal(await f.exists(), false)
  })
  test(name + ': a new human read-only scope invalidates the earlier evidence lease before any write', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    let checks = 0
    f.services.sandboxPolicy.resolve = () => { checks++; if (checks === 1) queueMicrotask(() => f.events.push({ type: 'user/message', seq: f.events.length, time: Date.now(), data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '此次仅做只读审阅，不创建派生存储' }] } })); return { mode: 'workspace-write' } }
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    await assert.rejects(f.call(name, action), /PERSISTENCE_DENIED/)
    assert.equal(await f.exists(), false)
  })
  test(name + ': unloading while an explicit mutation waits for a lease aborts before any store write', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    const waiting = Promise.withResolvers(), started = Promise.withResolvers()
    const original = f.services.sessionQuery.observeSession
    f.services.sessionQuery.observeSession = async (...args) => { started.resolve(); await waiting.promise; return original(...args) }
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    const pending = f.call(name, action)
    const rejected = assert.rejects(pending, { name: 'AbortError' })
    await started.promise
    f.dispose()
    waiting.resolve()
    await rejected
    assert.equal(await f.exists(), false)
  })
  test(name + ': authorized writable task still records derived state', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    await f.stop()
    assert.equal(await f.exists(), true)
  })
}
