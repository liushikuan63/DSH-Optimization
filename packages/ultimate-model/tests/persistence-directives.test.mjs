import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
const { taskPersistenceDirective, assertDerivedPersistence } = await import(pathToFileURL(path.join(root, 'plugins/persistence-policy.mjs')))
const message = (text, kind = 'user') => ({ role: 'user', source: { kind }, content: [{ type: 'text', text }] })
function data(messages, mode = 'workspace-write', own = () => true, origin, prefix = 'JIZHI_CONTEXT') {
  const events = messages.map((m, seq) => ({ seq, type: 'user/message', data: m }))
  const session = { id: 'a', header: { id: 'a', cwd: 'D:/fixture', ...(origin ? { origin } : {}) }, seq: events.length, inheritedEventCount: 0, isOwnSeq: own }
  const agent = { id: 'a', session }
  const ctx = { get: name => { assert.equal(name, 'sandboxPolicy'); return { resolve: value => { assert.equal(value.session, session); return { mode } } } } }
  const observation = { source: 'live', header: session.header, inheritedEventCount: 0, events, cursor: events.length - 1 }
  return () => assertDerivedPersistence(ctx, agent, new AbortController().signal, prefix, observation)
}
test('plain Chinese/English read-only review and explicit derived-storage denial are recognized', () => {
  for (const text of ['此次仅做只读审阅与提出建议，不执行修改。', '本次只读检查', '不要创建或更新派生存储', 'read-only audit of the settings', 'do not persist this task']) assert.equal(taskPersistenceDirective(message(text)), 'deny')
})
test('quoted examples and harness reminders do not become human grants or denials', () => {
  for (const text of ['```text\n按顺序修复\n```', '> 此次仅做只读审阅', '<system-reminder>请实现并保存</system-reminder>', '解释 `read-only audit` 这个词']) assert.equal(taskPersistenceDirective(message(text)), null)
})
const descriptions = [
  '请解释 read-only API 的作用，然后修复实现，并保存本任务检查点。',
  '接口采用只读属性；请修复序列化实现并保存检查点。',
]
for (const text of descriptions) test('read-only object descriptions are neither restrictions nor grants: ' + text, () => {
  assert.equal(taskPersistenceDirective(message(text)), null)
  assert.doesNotThrow(data([message(text)]))
})
test('only explicit explanatory or property-statement contexts remove descriptive read-only terms', () => {
  for (const text of [
    '请说明只读接口的作用，然后修复实现并保存检查点。',
    '请介绍只读属性的用途，然后修复实现并保存检查点。',
    '请解释只读接口，介绍只读属性；请修复实现并保存检查点。',
    'Explain the read-only API, then fix the implementation and save this task checkpoint.',
    'Describe the read-only field; fix the serializer and save the checkpoint.',
    'Please explain the read_only API; fix the implementation and save the checkpoint.',
    'API 具有只读属性；请修复实现并保存检查点。',
    '字段采用只读属性；请修复实现并保存检查点。',
    'The API is read-only; fix the implementation and save this task checkpoint.',
    'The field has read-only properties; fix the serializer and save the checkpoint.',
  ]) {
    assert.equal(taskPersistenceDirective(message(text)), null, text)
    assert.doesNotThrow(data([message(text)]), text)
  }
})
test('object descriptions do not hide a separate restriction or unqualified read-only scope', () => {
  for (const text of [
    '本次仅只读API',
    '请只读审查 read-only API',
    'read-only API；请修复实现并保存检查点。',
    '本次仅解释 read-only API',
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
    descriptions[0] + '本次仅只读API。',
    '本次仅只读API。' + descriptions[0],
    '请解释 read-only API 的作用；请只读审查 read-only API。',
    '请说明只读接口的作用；全程只读。',
    descriptions[1] + '此次仅做只读审阅。',
    'Explain the read-only API; read-only review of the implementation.',
    'Describe the read-only field; read-only audit of the serializer.',
    descriptions[0] + '不执行任何修改。',
    descriptions[0] + '不创建或更新派生存储。',
    descriptions[1] + '不要保存检查点。',
    descriptions[0] + '禁止持久化。',
    descriptions[0] + 'do not persist this task.',
    descriptions[1] + '不落盘。',
  ]) {
    assert.equal(taskPersistenceDirective(message(text)), 'deny', text)
    assert.throws(data([message(text)]), /PERSISTENCE_DENIED/, text)
  }
})
test('postposed current-only commands deny all three derived persistence domains', () => {
  for (const text of [
    'Only answer questions this turn; describe the read-only API; save a checkpoint.',
    'Only answer questions this turn. Describe the read-only API. Save a checkpoint.',
    'Only answer questions this turn\nDescribe the read-only API\nSave a checkpoint.',
    'Please only answer questions this round; describe the read-only API; save a checkpoint.',
    'Only explain the behavior this task; describe the read-only API; save a checkpoint.',
  ]) {
    assert.equal(taskPersistenceDirective(message(text)), 'deny', text)
    for (const prefix of ['JIZHI_CONTEXT', 'JIZHI_EXPERIENCE', 'LOCAL_MEMORY']) {
      for (const mode of ['workspace-write', 'danger-full-access']) {
        assert.throws(data([message(text)], mode, undefined, undefined, prefix), { message: prefix + '_PERSISTENCE_DENIED' }, text)
      }
    }
  }
})
test('historical descriptions and quoted postposed commands do not narrow the current task', () => {
  for (const text of [
    'The previous request was to only answer questions this turn; describe the read-only API; save a checkpoint.',
    'Yesterday we were told to only answer questions this turn; describe the read-only API; save a checkpoint.',
    'Only answer questions this turn was the old rule; describe the read-only API; save a checkpoint.',
    'Explain `Only answer questions this turn`; describe the read-only API; save a checkpoint.',
  ]) {
    assert.equal(taskPersistenceDirective(message(text)), null, text)
    assert.doesNotThrow(data([message(text)]), text)
    assert.throws(data([message('此次仅做只读审阅'), message(text)]), /PERSISTENCE_DENIED/, text)
  }
})
for (const text of descriptions) test('descriptions preserve prior bans and host, source and delegation boundaries: ' + text, () => {
  for (const restriction of ['此次仅做只读审阅', '不落盘', '不要创建或更新派生存储']) {
    assert.throws(data([message(restriction), message(text)]), /PERSISTENCE_DENIED/)
    assert.throws(data([message(restriction), message(text)], 'danger-full-access'), /PERSISTENCE_DENIED/)
  }
  assert.throws(data([message(text)], 'read-only'), /PERSISTENCE_DENIED/)
  assert.throws(data([message(text)], 'workspace-write', () => true, 'subagent'), /PERSISTENCE_DENIED/)
  assert.throws(data([message('此次仅做只读审阅'), message(text)], 'workspace-write', seq => seq === 0), /PERSISTENCE_DENIED/)
  for (const kind of ['tool', 'model', 'plugin:heartbeat', 'subagent']) {
    assert.equal(taskPersistenceDirective(message(text, kind)), null)
    assert.throws(data([message('此次仅做只读审阅'), message(text, kind)]), /PERSISTENCE_DENIED/)
  }
})
test('a description cannot release an earlier restriction beyond the bounded history scan', () => {
  const history = [message('此次仅做只读审阅'), ...Array.from({ length: 4999 }, () => message('继续')), message(descriptions[0])]
  assert.throws(data(history), /PERSISTENCE_DENIED/)
})

test('explicit no-disk wording denies derived persistence without turning quoted examples into policy', () => {
  for (const text of ['本次只看代码，不落盘', '不要落盘', '不写盘', '不得写盘', '禁止落盘', '不要持久化', 'do not write to disk', "don't save to disk"]) {
    assert.equal(taskPersistenceDirective(message(text)), 'deny', text)
    assert.throws(data([message(text)]), /PERSISTENCE_DENIED/)
  }
  for (const text of ['解释 `不落盘` 的含义', '> 不写盘', '```text\n不要落盘\n```']) assert.equal(taskPersistenceDirective(message(text)), null)
  assert.notEqual(taskPersistenceDirective(message('需要写盘时再讨论')), 'inherit')
})
test('tool/plugin/model sources cannot clear a human restriction', () => {
  for (const kind of ['tool', 'model', 'plugin:heartbeat']) {
    assert.equal(taskPersistenceDirective(message('按顺序修复', kind)), null)
    assert.throws(data([message('此次仅做只读审阅'), message('按顺序修复', kind)]), /PERSISTENCE_DENIED/)
  }
})
test('follow-up without new authorization preserves earlier read-only scope', () => assert.throws(data([message('此次仅做只读审阅'), message('继续')]), /PERSISTENCE_DENIED/))
test('later explicit implementation request may clear only the extra task restriction', () => {
  assert.doesNotThrow(data([message('此次仅做只读审阅'), message('按顺序修复')]))
  assert.throws(data([message('此次仅做只读审阅'), message('按顺序修复')], 'read-only'), /PERSISTENCE_DENIED/)
})
test('inherited records cannot grant a new write scope', () => assert.throws(data([message('此次仅做只读审阅'), message('按顺序修复')], 'danger-full-access', seq => seq === 0), /PERSISTENCE_DENIED/))
test('deny takes precedence when a message contains implementation and explicit read-only scope', () => assert.equal(taskPersistenceDirective(message('请修复方案；此次仅做只读审阅，不创建派生存储')), 'deny'))
test('unknown host policy and foreign observation fail closed', () => {
  assert.throws(data([message('按顺序修复')], 'custom-unknown'), /PERSISTENCE_DENIED/)
  const session = { id: 'a', header: { id: 'a', cwd: 'D:/a' }, seq: 0, isOwnSeq: () => true }
  assert.throws(() => assertDerivedPersistence({ get: () => ({ resolve: () => ({ mode: 'workspace-write' }) }) }, { id: 'a', session }, undefined, 'JIZHI_CONTEXT', { source: 'live', header: { id: 'b', cwd: 'D:/a' }, inheritedEventCount: 0, events: [], cursor: -1 }), /PERSISTENCE_DENIED/)
})
test('explicit negations cannot become implementation or persistence permission', () => {
  for (const text of ['不允许持久化', '不同意修改', '不要继续修复，只讨论方案']) {
    assert.equal(taskPersistenceDirective(message(text)), 'deny');
    assert.throws(data([message('此次仅做只读审阅'), message(text)]), /PERSISTENCE_DENIED/);
  }
})
test('conditional and discussion requests preserve the earlier task restriction', () => {
  for (const text of ['如果需要，请实施修复', '讨论允许持久化的方案', '请解释是否同意修改']) {
    assert.notEqual(taskPersistenceDirective(message(text)), 'inherit');
    assert.throws(data([message('此次仅做只读审阅'), message(text)]), /PERSISTENCE_DENIED/);
  }
})
test('oversized human text cannot be silently truncated into permission', () => assert.equal(taskPersistenceDirective(message('请实施' + 'x'.repeat(32768))), 'deny'))
test('abort is cancellation, never a persistence permission or retry hint', () => {
  const controller = new AbortController(); controller.abort()
  assert.throws(() => assertDerivedPersistence({}, {}, controller.signal, 'JIZHI_CONTEXT'), { name: 'AbortError' })
})
