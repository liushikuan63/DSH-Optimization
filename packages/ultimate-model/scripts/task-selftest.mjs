import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateReference } from '../plugins/context-checkpoint/store.mjs'

export const LIMITS = Object.freeze({ maxBytes: 65536, maxChecks: 32, maxText: 512 })
const LAYERS = ['static', 'isolated', 'host', 'user-path']
const EXECUTIONS = ['completed', 'failed', 'skipped', 'blocked', 'cancelled']
const invalid = () => new Error('TASK_SELFTEST_INPUT')
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value)
const scalar = value => value === null || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value))
  || (typeof value === 'string' && value.length <= LIMITS.maxText)
function object(value, keys, required = keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).some(key => !keys.includes(key))
    || required.some(key => !Object.hasOwn(value, key))) throw invalid()
}
function validate(ledger) {
  object(ledger, ['schemaVersion', 'taskType', 'scope', 'revision', 'checks', 'observations', 'claim'])
  if (ledger.schemaVersion !== 1 || !['read-only', 'change'].includes(ledger.taskType)
    || !identifier(ledger.scope) || !identifier(ledger.revision)
    || !['complete', 'partial', 'blocked', 'cancelled'].includes(ledger.claim)
    || !Array.isArray(ledger.checks) || ledger.checks.length < 1 || ledger.checks.length > LIMITS.maxChecks
    || !Array.isArray(ledger.observations) || ledger.observations.length > LIMITS.maxChecks) throw invalid()
  const ids = new Set(), observed = new Set()
  for (const check of ledger.checks) {
    object(check, ['id', 'kind', 'requiredLayer', 'expected'])
    if (!identifier(check.id) || ids.has(check.id) || !['positive', 'negative', 'outcome'].includes(check.kind)
      || !LAYERS.includes(check.requiredLayer) || !scalar(check.expected)) throw invalid()
    ids.add(check.id)
  }
  if (ledger.taskType === 'change' && ['positive', 'negative'].some(kind => !ledger.checks.some(check => check.kind === kind))) throw invalid()
  for (const observation of ledger.observations) {
    object(observation, ['checkId', 'scope', 'revision', 'layer', 'execution', 'actual', 'ref'], ['checkId', 'scope', 'revision', 'layer', 'execution'])
    if (!ids.has(observation.checkId) || observed.has(observation.checkId)
      || !identifier(observation.scope) || !identifier(observation.revision)
      || !LAYERS.includes(observation.layer) || !EXECUTIONS.includes(observation.execution)
      || (Object.hasOwn(observation, 'ref') && !identifier(observation.ref))) throw invalid()
    if (observation.execution === 'completed') {
      if (!Object.hasOwn(observation, 'actual') || !scalar(observation.actual) || !Object.hasOwn(observation, 'ref')) throw invalid()
    } else if (Object.hasOwn(observation, 'actual')) throw invalid()
    observed.add(observation.checkId)
  }
}

/** Audit supplied facts only. This neither observes a session nor authenticates evidence. */
export function gradeTask(ledger) {
  validate(ledger)
  const observations = new Map(ledger.observations.map(item => [item.checkId, item]))
  const checks = ledger.checks.map((check, checkIndex) => {
    const observation = observations.get(check.id)
    const result = (status, reason) => ({ checkIndex, status, reason })
    if (!observation) return result('unverified', 'missing-evidence')
    if (observation.scope !== ledger.scope) return result('unverified', 'scope-mismatch')
    if (observation.revision !== ledger.revision) return result('unverified', 'revision-mismatch')
    if (observation.layer !== check.requiredLayer) return result('unverified', 'layer-mismatch')
    if (observation.execution === 'failed') return result('fail', 'execution-failed')
    if (observation.execution !== 'completed') return result('unverified', observation.execution)
    return Object.is(observation.actual, check.expected) ? result('pass', 'matches') : result('fail', 'outcome-mismatch')
  })
  const counts = { pass: 0, fail: 0, unverified: 0 }
  for (const check of checks) counts[check.status]++
  let status = counts.fail ? 'fail' : counts.unverified ? 'unverified' : 'pass'
  const reasons = []
  if (ledger.claim === 'complete' && status !== 'pass') {
    status = 'fail'; reasons.push('unsupported-completion')
  }
  if (['blocked', 'cancelled'].includes(ledger.claim)) {
    if (status !== 'fail') status = 'unverified'
    reasons.push('task-stopped')
  }
  // Do not echo supplied labels, expected/actual values, references, or raw input.
  return { schemaVersion: 1, scope: 'supplied-evidence-consistency', status, counts, reasons, checks,
    provenanceVerified: false, actionsExecuted: false,
    boundary: 'Checks supplied ledger consistency only; does not prove runtime state, model behavior, evidence authenticity or authorization.' }
}

const normalized = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value)
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.nlink === 1 && b.nlink === 1
/** Explicit workspace-relative JSON only; no history discovery, write, shell, or network. */
export async function readLedger(cwd, reference) {
  try {
    const relative = validateReference(reference), root = path.resolve(cwd)
    const rootStat = await fs.lstat(root)
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || normalized(await fs.realpath(root)) !== normalized(root)) throw invalid()
    const parts = relative.split('/')
    let full = root, before
    for (let i = 0; i < parts.length; i++) {
      full = path.join(full, parts[i]); before = await fs.lstat(full)
      if (before.isSymbolicLink() || normalized(await fs.realpath(full)) !== normalized(full)
        || (i < parts.length - 1 ? !before.isDirectory() : !before.isFile() || before.nlink !== 1)) throw invalid()
    }
    if (before.size > LIMITS.maxBytes) throw invalid()
    const handle = await fs.open(full, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
    try {
      const opened = await handle.stat()
      if (!sameFile(before, opened)) throw invalid()
      const bytes = Buffer.alloc(LIMITS.maxBytes + 1)
      let used = 0
      while (used < bytes.length) {
        const { bytesRead } = await handle.read(bytes, used, bytes.length - used, used)
        if (!bytesRead) break
        used += bytesRead
      }
      const after = await handle.stat(), linked = await fs.lstat(full)
      if (used > LIMITS.maxBytes || used !== before.size || linked.isSymbolicLink()
        || !sameFile(opened, after) || !sameFile(after, linked)
        || normalized(await fs.realpath(full)) !== normalized(full)) throw invalid()
      return JSON.parse(bytes.toString('utf8', 0, used))
    } finally { await handle.close() }
  } catch { throw invalid() }
}

export async function runCli(args, cwd = process.cwd()) {
  if (args.length !== 1 || !args[0].startsWith('--input=') || args[0].length === 8) throw invalid()
  const report = gradeTask(await readLedger(cwd, args[0].slice(8)))
  return { report, exitCode: report.status === 'pass' ? 0 : report.status === 'fail' ? 1 : 3 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { report, exitCode } = await runCli(process.argv.slice(2))
    console.log(JSON.stringify(report)); process.exitCode = exitCode
  } catch {
    console.error(JSON.stringify({ error: 'TASK_SELFTEST_INPUT', usage: 'node scripts/task-selftest.mjs --input=workspace-relative.json' }))
    process.exitCode = 2
  }
}
