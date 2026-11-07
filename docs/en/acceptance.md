# Acceptance report — 0.1.3 documentation edition / Ultimate-Model 1.4.3-review.6

[简体中文](../acceptance.md) · English

The recorded acceptance work took place on 2026-11-07 (Asia/Shanghai). The main integrator implemented and deployed the changes. Separate validators unpacked the final plugin ZIP, prepared isolated copies, exercised the SDK/UI, and checked the official bundle manager. All environments were on the same user's Windows x64 machine. “Independent” describes responsibility, extraction directories, and isolated Home/profile directories; it does not mean a second computer.

Version 0.1.3 adds bilingual documentation. It does not change the frozen Ultimate-Model code or ZIP, and it does not add another run of the 311 plugin tests, 16 workflow tests, SDK/UI acceptance, or paid model tasks. Existing evidence applies to the same verified bytes. The documentation archive needs its own final archive/source comparison after it is frozen.

The [sanitized machine-readable summary](../evidence/acceptance-summary.json) uses the same evidence layers. The third controlled continuation task passed; the first two attempts remain recorded as failures. See the [real model record](real-model-validation.md) and [deployment guide](deployment.md).

## Frozen plugin artifact

- File: `Ultimate-Model-1.4.3-review.6.zip`; 705119 bytes and 215 archive members.
- SHA256: `9938562f6691e67a35c40fe83b37cf5d496c4953ee388e4e8a882396ca4266ab`.
- `FILES.sha256` covers 214 files; the manifest itself is the remaining member. CRC, safe paths, case collisions, links, and exact manifest membership passed.
- The distributed structure contains 55 skills and 25 composed plugin rows. These counts do not mean that all skills are resident or that all rows are separate new plugins.
- The preserved original input was 1.4.3-review.2, SHA256 `730c69584c7cd57a953782533459d00503c00e40a2a661414125a1a374110b67`.

The complete share ZIP also contains optional global workflow rules, their installer, and the documentation. Its exact hash belongs in the matching `.zip.sha256` sidecar and release receipt. A document inside an archive cannot embed that archive's final hash without changing it.

## Verified layers and their limits

| Layer | Actual entry or action | Recorded result and boundary |
| --- | --- | --- |
| Plugin static check | `node scripts/prepare-install.mjs --check` | Exit 0; read-only manifest, template, and resource checks. |
| Independent plugin regression | Fresh copy, `node scripts/prepare-install.mjs --tests`, temporary root outside the user Home | 311 passed; 0 failed, cancelled, skipped, or todo; exit 0. The integrator also ran 311 tests on the candidate. |
| Installed SDK startup | Original DSH NEXT 2.0.20-next / SDK 0.2.1-rc.3, isolated base + web-app + this bundle | `ultimate-model` resolved without a broken preset or old Home rows shadowing the bundle. |
| Host/UI | Isolated loopback Host and system Chrome in headless mode | After the preview dialog was dismissed normally, the mode could be selected; the actual session used Ultimate-Model and retained that selection after refresh. |
| Actual file tools | Deterministic offline model fixture driving the official write/read tools | The tools executed and read back 29 bytes, SHA256 `472ba4bb2cdb7f7d4a9b445956f40af5b2bdf7243289222dc4864a6cff097a68`. |
| Stop | Normal UI Stop action | The fixture received AbortSignal; the official journal ended as aborted/user, without automatic revival. |
| No persistence | The user entered “本轮不落盘”; production `jizhi_context.save` and `jizhi_experience.review` were invoked | Both returned `PERSISTENCE_DENIED`; existing experience/checkpoint bytes, hashes, and mtimes were unchanged. Disabled-by-default local_memory was not claimed as an exercised tool. |
| Official local-directory installation | SDK `PluginManager.installBundle/listBundles/removeBundle` | pnpm 11.7.0 JavaScript distribution, offline, no dependency scripts approved. Install exit 0, `restart-required/no-hmr`, `warnings=[]`; an absolute `link:` dependency with 8/8 resources inside the physical installed root. Removal exit 0; dependency, selection, link, list entry, and lockfile references removed. |
| Global workflow installer | `node --test scripts/tests/workflow-overlay.test.mjs` | 16/16; no failures or skips. Synthetic Homes cover original bytes, backups, repeated application, local customization, concurrent changes, links, and invalid input. |
| Local workflow adoption | Explicit Home target, controlled maintenance of the previously owned block, then a read-only plan | The original 13587 bytes were preserved; complete backups matched on readback. After the EPERM guidance update, AGENTS was 15830 bytes and the final plan was `KEEP`. The public CLI still returns `REVIEW_UPDATE` for a different or customized block. |
| Windows test subprocess EPERM | Same single test file in the original SDK's read-only sandbox | Default `node --test` failed with `spawn EPERM`, exit 1. `node --test --test-isolation=none calculator.test.mjs` passed all 4 fixture tests, including a protected-write negative case. No elevation or sandbox relaxation. |
| Local guards | Existing foreground authorization retained; actual editor fields and recursive-delete coverage added | The original 27 guard tests passed. UM also contains shared single-use authorization, expiry, identity, and cancellation counterexamples. |
| Recorded local deployment | Stopped-instance backup, per-file preimage checks, registered link directory update, normal restart | review.6 was installed. The recorded run emitted `process.ready`, `host.start.complete`, and `renderer.recovery.healthy`; existing disabled choices, account/model configuration, other bundles, and personal data were retained. This row describes that deployment snapshot. |

The SDK/UI model was an offline fixture with **0 real Provider requests**. This proves the exercised tool/state/UI path, not model quality or account connectivity. No pageerror was observed; one deliberate refresh produced `/plugins/events` SSE `net::ERR_ABORTED`. A console.error listener was not installed, so the record does not claim zero console errors. At that isolated test's teardown, the Host/browser closed and no owned Host remained.

The [isolated SDK/UI screenshot](../evidence/isolated-sdk-ui-fixture.png) contains only the synthetic task and visibly labels the model “Offline audit fixture.” Its completion text is not evidence of real model performance.

## Real model task

**The third controlled continuation passed: 11/20 SDK main requests in 103.662/300 seconds.** It resumed two files previously generated by DSH. There was one human task message, no coordinator prompt during execution, and no coordinator-written artifact. The model ran tests, introduced and restored a fault, completed VIBECODING, and ended normally as `completed`. Independent journal, source, protected-file, and output checks gave `PASS_CONTROLLED_REAL_MODEL_CONTINUATION`.

| Attempt | SDK main requests / elapsed time | Outcome |
| --- | --- | --- |
| First | 6 / 39.929 s | A temporary async guard violated the synchronous SDK contract. All 7 tool results failed JSON admission; 0/3 artifacts. `FAIL_BUDGET_EXHAUSTED_NO_ARTIFACTS`. |
| Second | An additional 6 / 45.802 s | Two code files were produced and independently passed 13 tests plus 23 input cases. The temporary allowlist denied edit and a test-command suffix; the ledger was missing and the model had not run tests. `FAIL_BUDGET_EXHAUSTED_PARTIAL_ARTIFACTS`. |
| Third | New allowance of up to 20; actual 11 / 103.662 s | After final SDK registration RED/GREEN, 16 policy tests, and a fresh Host fixture check of the final helper, all 3 artifacts were present and the bounded continuation passed. |

The third attempt's actual test order was:

1. Same-process test: 13 passed, exit 0.
2. Default subprocess isolation: `spawn EPERM`, exit 1; 0 passed / 1 failed.
3. Finite-number validation temporarily disabled: 9 passed / 4 failed, exit 1.
4. Original validation restored: 13 passed / 0 failed, exit 0.

All four runs had zero skips/cancellations. The effective command was:

```powershell
node --test --test-isolation=none calculator.test.mjs 2>&1; Write-Output "EXITCODE=$LASTEXITCODE"
```

The default-isolation diagnostic omitted `--test-isolation=none`. The four RED failures include parent-test propagation, not four independent input groups. No test was removed, no system permission was changed, and the sandbox was retained. This compatibility path does not eliminate all EPERM causes or establish equivalence for every suite.

The independent validator reread the code and ran `node --test --test-reporter=tap calculator.test.mjs`: 13 passed, exit 0, no failures/skips/cancellations. Five positive and 18 invalid-input cases also passed. The final set was exactly six files. The original three files retained their bytes, hashes, and mtimes; calculator/test final hashes matched the continuation baseline. The model's 6773-byte VIBECODING contains the goal, two-stage plan, actual commands/exits, RED/GREEN evidence, and unverified limits. The validator did not supply it.

The 22 real tool results include 20 successes and two recovered errors: reading VIBECODING before it existed, and a Get-FileHash command outside the temporary exact allowlist. These errors were retained. Global workflow instructions were observed in user-role durable messages, and UM's resident reminder in system-role messages; this is not a complete HTTP context export.

The three attempts consumed **6 + 6 + 11 = 23 SDK main requests**. The third allowance's unused nine requests were not consumed. Existing adapter HTTP retries were expressly allowed for each run; HTTP counts, tokens, and actual charges were not measured. Earlier failures remain failures. This PASS covers a small owned continuation using existing DSH code, not arbitrary projects, long-running stability, or every plugin combination.

## Runtime snapshots and later observations

After the controlled work, the temporary runner/budget rows were removed, the Home patch was restored to its exact pre-test bytes, and DSH was restarted normally. The recorded cleanup snapshot had the three startup health events above. It also contained an account-read error of a class already observed before review.6. Host readiness never established that all accounts or console paths were error-free.

A later read-only snapshot was observed at **2026-11-07T00:25:04.281Z**. The preceding run had recorded `clean=true` at `run.end` at 00:13:07.396 UTC; the later run started at 00:13:13.189 UTC. This describes recorded lifecycle events without attributing who initiated the restart. The check itself did not restart DSH.

The later snapshot reported the same static manifests/configuration and three startup health events, alongside **12 recorded errors: 1 account-read renderer error, 10 OTHER renderer errors, and 1 host.session error**. The bounded technical classification is complete: the account-read renderer entry was identified, while explicit UM/jizhi, module-load, broken, EPERM, authentication, and rate-limit markers were all zero. An error name/code/HTTP status could not be extracted. There were no owned-workspace path markers or markers for any of the three owned acceptance sessions. The result receipt SHA256 is `ac88da7e3a772aba679ece333e7128068eb9fbe0f4e728a6b6c04392ee5ef7df`.

The cause remains **UNDETERMINED**. Absent markers do not rule out a relationship to installed components; they are a limited classification, not proof of independence or repair. No chats, journals, or account contents were read for this later check. The documentation does not collapse these 12 errors into the earlier single account entry or claim that the current run is error-free. Earlier accepted snapshots and later runtime issues remain separate evidence in the summary.

A separate owned SDK check without the temporary helper passed read→edit and the original PowerShell suffix command: 13/13, exit 0, 0 model/network calls. Two ConstrainedLanguage startup stderr entries were retained. That narrow tool check is not autonomous model-delivery evidence or a clean-stderr claim.

## Failure retention, recovery, and unverified scope

- review.3 had passed 303 tests, but an independent real-SDK check found that a private native CUA registration dependency could break the whole preset. The duplicate provider was removed; the final frozen review.6 ZIP was validated again. Old success was not reused for changed bytes.
- Index/tier metadata, materialized patch, and manifest publication use captured input, object identity/hash preimages, recoverable staging, and bounded EPERM/EBUSY/EACCES retries. Committed publication with failed cleanup is distinguished from failed publication. Concurrent writes and recovery records must be preserved.
- The convenience preparation entry verifies the manifest with Node builtins before invoking package scripts. A manifest does not authenticate its own download source or entrypoint.
- Explicit no-persistence intent constrains automatic saves and related explicit tools. Quoted text, tool output, and inherited history do not create new authorization.
- The official-manager probe's first removal failed because the probe used command-specific pnpm flags. Switching to generic `--config.*` offline/no-script settings completed removal of the same profile without another install or broader permissions; the failed evidence remains.
- Modal behavior was handled through normal close/confirm controls. No force click, inert removal, or disabled vision feature was used to claim successful selection.

The recorded toolchain includes Node 24 (package minimum: Node 22), core 0.2.1-rc.3, Playwright Core 1.61.1, system Chrome, and pnpm 11.7.0 JS. The declared core range is `>=0.2.1-rc.2 <0.3.0`; every version in that range was not tested. Windows ARM, macOS, Linux, UNC paths, file/tgz/registry copy installs, and all native-pnpm locking cases remain unverified.

Skill keywords retrieve candidates; the current model makes USE/SKIP/ASK/NEEDS_FACTS decisions. This is a workflow contract, not a new mandatory classifier. VibeCoding, prompt improvement, and parallel ownership reuse existing capabilities without adding another resident model, SQLite governor, compactor, or native driver.

Regression counterexamples do not prove that intermittent EPERM can never recur. The finite credential/read/delete checks do not cover arbitrary scripts, indirect calls, or logic mistakes. Cross-platform matrices, real business long tasks, arbitrary concurrent writes, remote databases/payments/production systems, additional paid services, CI, and all third-party combinations were not tested. Skipped, unknown, and unrun checks are not passes. Private Home/profile data, accounts, experience/checkpoint stores, raw journals, token-bearing startup logs, and one-off acceptance helpers are excluded from the public package.
