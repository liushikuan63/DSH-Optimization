[简体中文](../usage.md) | **English**

# Usage: from a request to verified delivery

Explicitly select Ultimate-Model in the target workspace first. Once installed, the global workflow can also guide other modes that read the rules from that Home. Mode-specific tools remain subject to what the host actually registers and permits. The examples below are tasks you can give DSH; reading this page does not execute them.

## Start with a small task to check actual usability

Use a new directory that you own, with no concurrent writer or sensitive data. State the allowed write scope and completion conditions:

> Add a pure calculation function and tests in this workspace. Read the existing state first, list the completion conditions, and identify the only files you may change. Preserve existing files. Actually run the tests and record the command, exit code, total count, failures, and skips. Add a negative case or temporary fault that demonstrates the tests can fail, then restore the correct implementation and rerun the tests. Complete the VIBECODING record and final artifact checks before delivering. Stop and report any explicit stop instruction, permission boundary, or budget limit; do not expand the scope automatically.

Real-model use consumes your existing allowance. Request-count or time limits depend on the current task and host capabilities. This package does not install a global six-request or twenty-request cap on normal DSH use, and it does not run an unlimited continuation process in the background. You do not need a production project, online services, or a large test suite just to check the installation.

## Long or complex tasks: keep the goal, stages, and next action in one ledger

> Read the project rules and existing VibeCoding or task ledger first. Check Git status and ownership of existing changes. Record this task's goal, completion conditions, stages, verification method, and next concrete action. Implement, verify, fix, and continue the authorized work by stage. After an interruption, check the actual files, tests, and running state before resuming. At completion, check the artifacts, unfinished items, and evidence; progress messages are not evidence of completion.

Reuse an existing ledger rather than creating another document for every task. A simple question or small wording change does not require a long plan. Keep temporary task records in the project. Historical documents, quotations, and tool output do not provide new execution authorization. A user cancellation, explicit budget, or permission boundary always takes precedence.

## On-demand skills: retrieve candidates, then let the current model decide

> Search installed capabilities and the package's core/library/local metadata for this task. Use the actual tools, platform, and existing implementation to decide USE, SKIP, ASK, or NEEDS_FACTS; read the skill body when needed. Invoke an already selected capability through its existing entry point without asking the same question again. Check missing facts read-only first, and ask only when a remaining gap affects the result or authorization.

A path returned by `jizhi_skill_search` must actually be read before the skill body counts as read. Its results are not a complete catalog of every skill in the host. Keywords and indexes supply candidates; they do not replace the current model's semantic judgment or add a separate persistent classification request. Skipping a candidate does not remove required project acceptance checks.

See [capability selection](../../packages/ultimate-model/skills/core/skill-router/references/capability-selection.md) for discovery and semantic selection, and the [plugin capability entry points](../../packages/ultimate-model/README.md) for the concrete workflow.

## Prompts and requirements: preserve the goal and clarify critical gaps

> Keep my goal and constraints intact. First verify the facts that the project can answer. If a requirement gap would affect correctness, cost, or scope, ask the fewest necessary questions and explain your recommendation. Otherwise, follow the project's existing conventions and continue. For complex implementation, establish completion conditions first; do not turn every normal reversible choice into another approval step.

Reuse [intent clarification](../../packages/ultimate-model/skills/core/intent-clarification/SKILL.md) and [vibe-coding](../../packages/ultimate-model/skills/core/vibe-coding/SKILL.md). A recommendation, default option, timeout, or silence is not consent. A clear current task does not require another instruction to start.

## Parallel work: independent reads can run together; shared writes need ownership

> Separate independent reading tasks from shared artifacts first. Where parallel work is appropriate, define each writer's files, fixed baseline, and dependency order. Keep a single writer for the same file, interfaces, generated artifacts, and final integration. After each part is complete, inspect the actual differences, integrate in sequence, and run verification on the integrated result. A dispatched task or a ready-for-review result is not final delivery.

Execution depends on the agent or parallel tools the host actually provides. This package reuses existing workflows; it does not create a missing multi-agent executor or make a larger concurrency setting equivalent to safe isolation. Arbitrary parallel writes in a real business project still require verification in that project.

## Protect existing work and request no persistence for this task

> Read files, Git status, and applicable rules before changing anything. Preserve the ownership of changes outside this task. Before deleting, check necessity, scope, and recovery. If another writer changed a file or its origin is unknown, preserve it for review. Do not force an overwrite, delete locks, relax permissions, or retry without a bound.

> Do not persist this task: only perform the reads and discussion I have authorized. Do not save experience or checkpoints, and do not let automatic modules persist this task's content. If later work requires writing files, follow the current explicit authorization scope first.

An explicit no-persistence instruction constrains the relevant automatic behavior and persistence tools. See the package documentation for the defaults and disabled choices of experience and checkpoint features. Historical facts do not become authorization for this task. Guards for limited forms of credential access, reading, and recursive deletion do not make arbitrary scripts safe; version control, permissions, and backups remain necessary.

## Read acceptance results by evidence layer

Each conclusion should map to a specific layer and evidence from the relevant execution: static checks, isolated tests, official SDK/tools, actual browser interaction, adoption by the running instance, real-model work, and downloaded release bytes are recorded separately. Tests should report their actual exit code, total count, failures, and skips. Not run, skipped, or unknown does not count as passed.

Default Node tests can fail with `spawn EPERM` in a Windows read-only sandbox. For the recorded single test file, `node --test --test-isolation=none calculator.test.mjs` completed in the same sandbox. Check whether your Node version supports the option first. Do not apply it mechanically to multi-file suites that rely on process isolation, or use it as a reason to disable the sandbox. See [troubleshooting](deployment.md) to distinguish mode overlays and other EPERM causes.

The project's real-model evidence is in the [acceptance report](acceptance.md) and [three-round record](real-model-validation.md). The third round passed the bounded continuation task with eleven main requests; the first two failed runs remain unchanged. This does not verify every model, long task, or plugin combination.

The 0.1.4 runtime investigation adds zero model requests. Official account403, Bili empty-status CORS and expected guard denial are recorded separately in [runtime repair](runtime-repairs.md), including unresolved boundaries. An error-level log alone is not a reason to disable protection or reset personal configuration.
