// Owner-configured, bounded foreground exceptions; not an OS security boundary.
// Never infer consent from tool arguments, environment flags, old history or a timeout.
import { constants, lstatSync, openSync, closeSync, fstatSync, readSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const MAX_BYTES = 32768
const MAX_TTL = 60 * 60 * 1000
const ACTIONS = new Set(['click', 'double_click', 'right_click', 'drag', 'scroll', 'press_key', 'hotkey', 'type_text'])
const FIELDS = new Set(['id', 'authority', 'evidence', 'sessionId', 'cwd', 'hostPid', 'pid', 'windowId', 'driverSession', 'actions', 'issuedAt', 'expiresAt', 'maxUses'])
const integer = value => Number.isSafeInteger(value) && value > 0
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max
const cwdKey = value => {
  if (!text(value, 4096)) return null
  if (path.win32.isAbsolute(value) && /^[A-Za-z]:/.test(value)) return path.win32.normalize(value).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase()
  return path.posix.isAbsolute(value) ? path.posix.normalize(value).replace(/\/$/, '') || '/' : null
}

function readPolicyFile(filename) {
  let fd
  try {
    const before = lstatSync(filename)
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size < 1 || before.size > MAX_BYTES) throw new Error('FG_POLICY_FILE')
    fd = openSync(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    const opened = fstatSync(fd)
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) throw new Error('FG_POLICY_CHANGED')
    const buffer = Buffer.alloc(MAX_BYTES + 1)
    let length = 0
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, null)
      if (count === 0) break
      length += count
    }
    if (length > MAX_BYTES) throw new Error('FG_POLICY_SIZE')
    return JSON.parse(buffer.subarray(0, length).toString('utf8'))
  } finally { if (fd !== undefined) closeSync(fd) }
}

function validGrant(g) {
  if (!object(g) || Object.keys(g).some(key => !FIELDS.has(key))) return false
  if (!text(g.id, 80) || !/^[A-Za-z0-9_-]+$/.test(g.id) || g.authority !== 'explicit-user-config' || !text(g.evidence, 1024)) return false
  if (!text(g.sessionId, 200) || !cwdKey(g.cwd) || !integer(g.hostPid) || !integer(g.pid) || !integer(g.windowId)) return false
  if (!text(g.driverSession, 80) || !Array.isArray(g.actions) || g.actions.length < 1 || g.actions.length > ACTIONS.size || new Set(g.actions).size !== g.actions.length || g.actions.some(action => !ACTIONS.has(action))) return false
  if (!Number.isInteger(g.maxUses) || g.maxUses < 1 || g.maxUses > 64 || typeof g.issuedAt !== 'string' || typeof g.expiresAt !== 'string') return false
  const issued = Date.parse(g.issuedAt), expires = Date.parse(g.expiresAt)
  return Number.isFinite(issued) && Number.isFinite(expires) && expires > issued && expires - issued <= MAX_TTL
}

function targetOf(a) {
  if (a.scope !== undefined && a.scope !== 'window') return null
  if (a.target !== undefined) {
    if (!object(a.target) || a.target.kind !== 'window' || a.pid !== undefined || a.window_id !== undefined) return null
    return integer(a.target.pid) && integer(a.target.window_id) ? { pid: a.target.pid, windowId: a.target.window_id } : null
  }
  return integer(a.pid) && integer(a.window_id) ? { pid: a.pid, windowId: a.window_id } : null
}

const stateKey = Symbol.for('local.dsh.foreground-grant-usage.v1')
const sharedUsage = globalThis[stateKey] ??= new Map()

export function createForegroundAuthorizer({ policyPath, readPolicy = readPolicyFile, now = Date.now, hostPid = process.pid, usage = sharedUsage, onGrant = () => {} } = {}) {
  return execution => {
    try {
      if (!object(execution) || execution.signal?.aborted !== false || !text(execution.name, 200) || !execution.name.startsWith('cua_driver_native__')) return false
      const action = execution.name.slice('cua_driver_native__'.length)
      const a = execution.arguments, agent = execution.agent, header = agent?.session?.header
      if (!ACTIONS.has(action) || !object(a) || (a.delivery_mode !== 'foreground' && a.deliveryMode !== 'foreground')) return false
      if (a.delivery_mode !== undefined && a.deliveryMode !== undefined && a.delivery_mode !== a.deliveryMode) return false
      if (!header || !text(header.id, 200) || agent.id !== header.id || agent.session.id !== header.id || !cwdKey(header.cwd)) return false
      const target = targetOf(a)
      if (!target || !text(a.session, 80)) return false
      const policy = readPolicy(policyPath)
      if (!object(policy) || Object.keys(policy).some(key => !['version', 'grants'].includes(key)) || policy.version !== 1 || !Array.isArray(policy.grants) || policy.grants.length > 32 || !policy.grants.every(validGrant) || new Set(policy.grants.map(g => g.id)).size !== policy.grants.length) return false
      const time = now()
      if (!Number.isFinite(time) || !(usage instanceof Map)) return false
      for (const [key, entry] of usage) if (entry.expiresAt <= time) usage.delete(key)
      for (const g of policy.grants) {
        const issued = Date.parse(g.issuedAt), expires = Date.parse(g.expiresAt)
        if (issued > time || expires <= time || g.hostPid !== hostPid || g.sessionId !== header.id || cwdKey(g.cwd) !== cwdKey(header.cwd)) continue
        if (g.pid !== target.pid || g.windowId !== target.windowId || g.driverSession !== a.session || !g.actions.includes(action)) continue
        const fingerprint = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(g).sort().map(key => [key, g[key]])))).digest('hex')
        let entry = usage.get(g.id)
        if (entry && entry.fingerprint !== fingerprint) return false
        if (!entry) {
          if (usage.size >= 128) return false
          entry = { fingerprint, expiresAt: expires, uses: 0, seen: new WeakSet() }
          usage.set(g.id, entry)
        }
        // The same real execution may pass global and preset guard layers.
        if (entry.seen.has(execution)) return true
        if (entry.uses >= g.maxUses) return false
        entry.uses++
        entry.seen.add(execution)
        onGrant({ id: g.id, sessionId: header.id, action, pid: target.pid, windowId: target.windowId, use: entry.uses })
        return true
      }
      return false
    } catch { return false }
  }
}
