# Diagnostic deadline core: developer API

`scripts/lib/diagnostic-deadline.mjs` exports `runGuard(plan, backend)`. It coordinates explicit diagnostic deadlines, identity checks, normal shutdown and restoration. It supplies no application installer or production process backend. Run it in an independent owned process so the timer survives coordinator exit or a paused model. Importing the module does not install plugins, change application configuration, create a service or monitor the computer. The library makes no model or network requests.

The plan requires `kind:"dsh-diagnostic-deadline-v1"`, current ISO UTC `createdAt`, unexpired `validUntil`, a newly created absolute `receiptDirectory`, and integer millisecond `maxWallMs`, `observeMs`, `operationMs`, `pollMs`. The total clock includes preflight, deployment, startup, shutdown and restoration. `observeMs` is the absolute time at which automatic stopping begins; reserve enough time for shutdown and restoration. Total budget is at most five minutes. Use a fresh directory per attempt; an existing journal prevents replay.

The backend contract is mandatory; dispatch success is not completion evidence.

| Method | Required guarantees |
|---|---|
| `preflight()` | Validate reviewed application/file/dependency provenance, permissions, backups and fresh transaction state. Reject unknown bytes and conflicts. |
| `snapshot()` | Return authoritative `{run,processes}`. Each process has `pid,parentPid,startedMs`. Active runs have `runId,pid,started,clean:false`; clean terminal runs may have `runId,pid,ended,clean:true` without retaining `started`. |
| `apply()` | Mutate only reviewed targets with pinned preimages, directory and backup identities. Reconcile uncertain commits rather than blindly retrying. |
| `launchDiagnostic()` | Start a specifically owned instance and return `pid,parentPid,notBeforeMs,notAfterMs`. Leave no launcher that can start it after timeout. |
| `normalQuit()` | Request normal shutdown only for the bound instance. A sent command proves neither main/Host exit nor shutdown ACK. |
| `cancelOwnedOperations()` | Cancel and settle owned helpers/operations within a finite time. Epoch/abort checks must prevent late writes and launches. Unconfirmed cancellation must fail and block restoration/restart. |
| `restore()` | Recheck absence of all relevant processes and the same clean terminal identity; restore trusted bytes by CAS. Handle an apply that committed before its response/receipt failed. |

Terminal identity requires matching run ID/PID, a clean flag, a canonical end time between the bound start and now, and absence of every relevant process. A surviving Host blocks restoration. ParentPID, creation-time and observed-ancestry checks remain strict.

`PASS` requires no failure, verified normal restoration and deadline compliance. Journal/receipt failures remain failures. Restoration establishes neither Host ACK, saved business data, account health nor native UI health. Correct backend guarantees are prerequisites. An ordinary JavaScript process cannot provide unconditional hard real-time recovery during OS stalls, sleep or blocking I/O.

Run `node --test scripts/tests/diagnostic-deadline.test.mjs` for 37 isolated regressions. Tests use real nonce-named Node main/Host children and exclusive `mkdtemp` directories under `os.tmpdir()`. Fixture processes exit through their nonce protocol; the parent uses signal 0 only to probe liveness and sends no termination signal to a PID. Before reading a nonce or creating a command, cleanup verifies the canonical root, creation identity and prefix, rejecting tree symlinks, junctions and multiply linked files. It rechecks after the nonce read, before command writing and before deletion. The command is created exclusively and its opened identity is checked, so existing aliases are not overwritten. Temporary removal requires confirmed fixture process exit. Real junction, marker-replacement and hardlink counterexamples assert unchanged external owned bytes. No fixture output remains in the source tree. Dependency pins and small-file CAS belong to the explicit test backend, which is not a production DSH backend.

This is isolated core-library evidence. The earlier native V1 diagnostic failure caused by the terminal-schema mismatch remains failed. This public library did not rerun native DSH diagnostics and does not prove production installation or automatic restoration.
