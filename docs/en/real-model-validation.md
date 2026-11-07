# Controlled real model validation

[简体中文](../real-model-validation.md) · English

This record separates the share package, the temporary acceptance helper, and the real model outcomes. The helper is not distributed in the repository/share ZIP or installed as permanent DSH configuration. Version 0.1.3 is a bilingual documentation update: it adds no new paid model run, 311/16 regression run, or SDK/UI acceptance. It retains the frozen review.6 bytes and their existing evidence.

See the [acceptance report](acceptance.md), [deployment guide](deployment.md), and [sanitized summary](../evidence/acceptance-summary.json).

## First attempt: failed with no artifacts

On 2026-11-07 (Asia/Shanghai), the user approved up to six DSH SDK main requests within 300 seconds of the first request, including the existing subscription adapter's internal HTTP retries. Internal HTTP generation counts and actual charges were not measured; six SDK requests must not be described as six HTTP requests.

The task was confined to an owned workspace: produce a sum function, Node tests, and VIBECODING while preserving the original three control files. Six SDK requests were sent. At 39.929 seconds, the budget guard stopped the run before a seventh dispatch. The exact owned journal contained six settled main attempts, seven native tool calls, and an aborted turn.

| Tool | Count | Result |
| --- | ---: | --- |
| skill | 2 | `vibe-coding` and `assertion-discipline`; both failed. |
| glob, read, pwsh, working_directory, progress_update | 1 each | All failed. |

Every result contained the same actual error:

```text
Error: tool result must be losslessly JSON-serializable
```

There was no run_code or todo_write call and no SDK retry marker. Absence of an SDK marker does not establish absence of internal Provider HTTP retries. No target artifact was created; the workspace still contained exactly the original three files with unchanged bytes, SHA256, and mtimes. Missing files were not tested. The result remains `FAIL_BUDGET_EXHAUSTED_NO_ARTIFACTS`, not model completion or proof of Provider failure.

## Temporary-helper contract defect

The installed SDK's `tools.guard` contract is synchronous. The helper had changed its registered callback to async to obtain skill metadata. Even an allowed async branch returns a Promise; that value entered a path expecting a synchronous denial/result value and failed JSON admission. An earlier full Host fixture had run before that change. Testing only the helper function afterward missed the final registered SDK contract.

The distributed package and permanent hook guards use synchronous callbacks; this temporary async change was not shipped. The temporary rows were removed, the Home patch restored, and DSH restarted normally. The first six consumed requests and their failed receipt were retained.

The repair awaits registered, model-invocable UM skill metadata during setup, builds an allowed-name set, then registers a fully synchronous guard. A direct check in the original SDK reproduced the exact failure with the old callback: tool body calls 0 and JSON admission failure. The final synchronous callback allowed one tool body execution and a successful result. The actual symptom was JSON serializability, not the earlier speculative `[object Promise]` text. This targeted GREEN did not replace full Host validation.

The repaired final source also passed 15 budget/policy tests and a fresh owned Host fixture. Six offline fixture main requests exercised skills, read/glob, directory/progress tools, three artifact writes/readback, and four read-only Node tests. Protected writes were denied; original controls retained bytes and mtimes; Host exit was 0 and network attempts were 0. The final registered source was checked, rather than reusing a fixture result from an earlier revision.

## Second attempt: partial artifacts, full task failed

The user separately approved another maximum of six SDK main requests / 300 seconds, with the same internal-retry boundary. After 45.802 seconds the run again stopped before the seventh dispatch. The first two attempts consumed 12 requests; the earlier receipt was not overwritten or reset.

Eight of ten native tool calls succeeded. The model produced `calculator.mjs` and `calculator.test.mjs`. Two rejections came from the temporary helper's additional restrictions: edit was not allowlisted, and the test command added:

```powershell
2>&1; Write-Output "EXITCODE=$LASTEXITCODE"
```

That suffix did not match the helper's exact command string, so testing was rejected before execution. The model subsequently used write to finish the edit. These were helper restrictions, not another Provider, JSON-admission, or EPERM failure. Normal DSH did not inherit that six-request cap.

After reviewing the generated sources for filesystem/network/process side effects, the independent validator ran `node --test --test-reporter=tap calculator.test.mjs`: 13/13, exit 0, no failures or skips. Five positive and 18 invalid-input cases passed, including sparse arrays, typed arrays, boxed numbers, NaN, and positive/negative Infinity. The two source files and three original controls were unchanged by validation.

`VIBECODING.md` was still missing, and the model session had not run tests. The result remains `FAIL_BUDGET_EXHAUSTED_PARTIAL_ARTIFACTS`. The independent green check was evidence of artifact correctness, not completed autonomous delivery. Neither budget-triggered stop establishes that the model would voluntarily quit early without the helper's temporary cap.

A separate owned SDK check used no budget/once/three-file helper and made no model calls. Normal read→edit succeeded after the required prior read; the original PowerShell suffix command then passed 13/13 with `EXITCODE=0` in a read-only sandbox. Protected files and the original sources retained bytes/mtimes. The initial edit without a prior read was correctly rejected, not bypassed. Two ConstrainedLanguage startup stderr entries were retained privately. This isolated tool check explains the allowlist distinction; it is not autonomous-task evidence or a clean-stderr claim.

## Third attempt: controlled continuation passed

The user then explicitly approved complete autonomous delivery with up to 20 additional SDK main requests. The run retained the 300-second window from its first request and the approved account/model/internal-retry boundary. The historical 12 requests were not reset, and the temporary cap was not installed as a global DSH policy.

The task resumed the two existing DSH-authored code files. It required actual testing, a demonstration that tests can fail, VIBECODING, and final delivery. The validator did not rewrite those files, supply the ledger, or send mid-run guidance. The original WORKSCOPE and three control files retained their bytes. The control JSON's old six-request value remained historical metadata; the new allowance was explicit in the current task and helper.

The final helper allowed read→edit only in the three-file write domain, plus four exact read-only Node command forms: default/same-process, with or without the approved output/exit suffix. No broader write domain or sandbox relaxation was introduced. Before live use, the final source passed registered SDK old-async RED / new-sync GREEN, 16 budget/policy tests, and a new owned Host fixture with read/edit/test, 13 Node tests, denied writes/edits to all three controls, exactly six final files, and zero network attempts. The helper still was not shipped.

The first main request was at **2026-11-06T23:56:18.489Z**; completion was at **23:58:02.151Z** (2026-11-07 07:56:18–07:58:02 locally). The run used **11 requests in 103.662 seconds**, within 20 / 300. Independent journal inspection found 11 settled main attempts, one human user message, final seq127 `completed`, and no in-flight step. Abort reason at completion was null. A later `disposed` state from normal helper cleanup does not change the completed task into an aborted one.

The status is `PASS_CONTROLLED_REAL_MODEL_CONTINUATION`. Actual model test output, in chronological order:

| Stage | Command category | Exit | Tests / pass / fail |
| --- | --- | ---: | --- |
| Initial GREEN | Same-process single-file test | 0 | 13 / 13 / 0 |
| Environment diagnostic | Default Node subprocess isolation | 1 | 1 / 0 / 1; spawn EPERM |
| Effective RED | Finite-number check temporarily disabled; same test rerun | 1 | 13 / 9 / 4 |
| Restored GREEN | Original validation restored; same test rerun | 0 | 13 / 13 / 0 |

All four had zero skips/cancellations. The effective command was:

```powershell
node --test --test-isolation=none calculator.test.mjs 2>&1; Write-Output "EXITCODE=$LASTEXITCODE"
```

The diagnostic omitted the isolation option. The model changed `if (!Number.isFinite(value))` to `if (false && !Number.isFinite(value))`, observed failure, then restored the original condition. Four failures include parent-test propagation; they are not four independent input groups. No system permissions, language restrictions, or original tests were removed. Default subprocess EPERM remains a limitation; same-process success is for this single-file path.

The final workspace contained exactly six files and all three requested artifacts. The model wrote a 6773-byte VIBECODING with the goal, two-stage plan, ownership, actual commands/exits, RED/GREEN, final acceptance, and limits. Its SHA256 is `2c6750f72ea41a03f09f0a5b19a69a3e7bb87d3b2022c82f87de46edb2d6ec2c`. The original controls retained bytes/hashes/mtimes. Calculator/test final hashes matched the continuation baseline; calculator's mtime could change because of the authorized fault injection and restoration.

The independent validator reread the sources and reran the explicit TAP command: 13/13, exit 0, no failures/skips/cancellations, plus five positive and 18 invalid-input cases. All six files retained bytes/mtimes across that independent check. CLI validation and model execution inside the DSH read-only sandbox are separate evidence. The private journal hash is `86cd2450afa2911396abaaa4d4789a55f6ff2384599fe596309c0f7da54acc66`; no raw account, rule, or other-session content is exported.

Twenty of 22 tool results succeeded. Two recovered errors remain visible: VIBECODING did not exist on its first read, and Get-FileHash exceeded the temporary shell allowlist. The model did not falsely claim to have executed that hash command; final hash/mtime checks came from independent validation. Ledger sections group commands by category; their commands and results still match the actual journal.

The three rounds consumed **6 + 6 + 11 = 23 SDK main requests**. The remaining nine were not consumed. Internal HTTP counts, tokens, and actual charges were not measured. Earlier failures keep their original status. This PASS covers a small continuation of existing DSH code, not from-scratch delivery of arbitrary complex projects or long-term reliability.

## Adoption, cleanup, and later runtime issues

Durable user-role messages contained the global workflow and Node EPERM guidance; UM's resident reminder was in system-role messages. The original agent-instructions prefix uses user role, so a system-only probe missed it. These are durable-message observations, not a full HTTP request capture. At the recorded runtime readback, Vision Router active/entrySeen/fiberSeen were all true.

After the third attempt, temporary runner/budget rows were removed, the Home patch restored to the exact pre-test bytes, and DSH restarted normally. Account/model settings, disabled choices, experience data, and permanent guards were retained. Normal DSH has neither the temporary six-request nor twenty-request acceptance cap.

That accepted snapshot is separate from the later run started at **2026-11-07T00:13:13.189Z**, after the preceding run recorded a clean end at 00:13:07.396 UTC. A read-only snapshot at 00:25:04.281 UTC found unchanged static manifests/configuration and three startup health events, alongside **12 errors: 1 account-read renderer error, 10 OTHER renderer errors, and 1 host.session error**. The bounded technical classification is complete. It found no explicit UM/jizhi, module-load, broken, EPERM, authentication, rate-limit, owned-path, or owned-session markers; error name/code/HTTP status could not be extracted. The cause remains **UNDETERMINED**, and marker absence does not exclude a relationship. No restart actor is inferred; the check did not restart DSH or read chats, journals, or account contents. See the [later runtime snapshot](acceptance.md#runtime-snapshots-and-later-observations). Earlier task completion does not certify the later run as error-free, and the later observations do not erase the completed task's evidence.

The 0.1.0, 0.1.1, and 0.1.2 artifacts remain unchanged. Version 0.1.3 adds bilingual explanations while retaining the identical review.6 plugin ZIP. No new model request is part of this documentation update; another paid task needs applicable authorization.
