# Deployment, updates, and recovery

For 1.0.0, live Ultimate-Model is `1.4.4`: five metadata/document files changed against the previously materialized review.7; 210 files and the materialized patch are preserved. Optional exact-byte runtime repairs and the developer deadline API are documented in [Runtime repairs](runtime-repairs.md). The 0.1.4 statements “live review.6 / maintenance HOLD” describe that earlier snapshot; see [acceptance](acceptance.md) for the later approval and completed maintenance. This is not standing approval for further maintenance or an extension of the spent diagnostic budget.

[简体中文](../deployment.md) · English

Historical0.1.3: this release added bilingual documentation only. It retains the frozen Ultimate-Model 1.4.3-review.6 code/ZIP and existing acceptance evidence; it does not rerun 311/16 tests, SDK/UI, installation, or paid models. See the [acceptance report](acceptance.md) and [real model record](real-model-validation.md) for exact layers and limitations.

## Prepare the final installation directory

Use the official bundle-manager flow and retain the complete plugin directory. The archive's expression-based patch is portable source. The Host compatibility preflight needs the materialized literal paths, so run the package preparation entry in the final directory before importing it:

```text
node scripts/prepare-install.mjs --check
node scripts/prepare-install.mjs
```

These commands run inside the plugin directory. Follow the [package installation instructions](../../packages/ultimate-model/INSTALL-AI.md). Moving an installed directory requires preparation at the new location and checking the manager's actual binding.

In the recorded SDK 0.2.1-rc.3 official local-directory installation, the saved dependency was `link:<absolute-directory>`. The node_modules realpath still pointed to the supplied directory; the manager did not run this package's preparation script. Put the package in a durable final location, prepare that copy, and keep it after installation. Do not delete a supposedly temporary extraction once the installed bundle links to it.

Other versions or file/tgz/registry installations may copy files instead. Check the actual installed directory and resource ownership; this local-link result does not validate every installation mode. Installation results such as `restart-required/no-hmr` are not proof that the running process has already adopted the change.

## Optional global workflow rules

The complete share package installs optional global rules separately from the plugin. From the complete package root, preview the explicitly named existing Home first:

```text
node scripts/install-workflow.mjs --home <ABSOLUTE_DSH_HOME>
```

The default plan is read-only. Add `--apply` only when the target and plan are correct. The installer appends its managed block and first keeps a complete backup of the original file. It does not change the default preset, register another hook, or alter model/account settings. A different or locally customized managed block returns `REVIEW_UPDATE` and is preserved for comparison; an update package is not authorization to replace personal rules. See the [workflow installer contract](../../overlays/README.md).

The standalone plugin ZIP supplies the preset's own workflow guidance, not this complete-package installer. File installation and runtime adoption remain separate checks.

## Incremental updates and composed configuration

Compare the trusted old package, current installed files, and new package before updating. Automatic replacement is appropriate only for a current file that still matches its traceable old version. Preserve customized or additional files, unknown sources, and concurrent changes for review. Do not overwrite global AGENTS, credentials, model/MCP configuration, other bundles, or personal state.

Home layers can override bundle rows with the same id. Keep disabled personal presets; the id alone is not proof that a row should be deleted. When migrating a known old managed observer, save the full file and per-row preimages, and retain local choices such as automaticReview/automaticSnapshot.

Disable a duplicated preset guard only after the global guard has been checked for the same version/contract and its actual coverage verified. Name or presence alone is not equivalence. Unknown old code stays under review; do not automatically remove new protection. Bounded foreground authorization must bind the real execution and share single-use consumption; provider presence or tool arguments cannot manufacture authorization.

`list_bundles`, a disk version, and `Tool.listTools` each report a limited view. None alone proves healthy execution or the adoption of every optional capability.

## Diagnose EPERM at the correct boundary

Identify the exact file, phase, object identity, bytes, and possible occupant. Retry a transient publication only within a finite bound while the expected object/content still matches. A held native dependency, a permission error, or a replaced target is not solved by unbounded retries. Do not change ACLs or stop another task to force progress.

Record cleanup failures separately from publication failures. Already committed metadata must not be combined with a directory rollback that creates mixed generations. Preserve recovery directories and records when concurrent data prevents safe restoration. The multi-file protocol is recoverable at application level, not atomic across arbitrary filesystems.

A separate recorded boundary involved Node 24's default test runner spawning a child in a Windows read-only sandbox. Default `node --test` produced `spawn EPERM`. The same single file passed all four fixture tests with:

```text
node --test --test-isolation=none calculator.test.mjs
```

It stayed in the same read-only sandbox and included a negative case where writing a protected file had to fail. The option changes Node's test-process organization; it does not disable the OS sandbox. Confirm support in the installed Node version's `--help` before using it. Shared state can affect multiple files, and a suite depending on process isolation cannot simply be treated as equivalent. See the [recorded Node 24.19 CLI option](https://nodejs.org/download/release/v24.19.0/docs/api/cli.html#--test-isolationmode).

Check the actual child exit, test count, failures, and skips. The real tool path returned `isError=false` even when a child command exited 1. Dispatch success or absence of a tool exception is not a passing test. The third controlled task's later 13-test RED/GREEN chain is separate from the four-test compatibility fixture.

## Modal guidance and mode selection

If a mode button is blocked, identify the foreground modal. DSH's preview dialog normally releases page inert after its Continue action. Vision Router's Later action suppresses only the current page; refresh or another page can show the introduction again. Its normal close button or supported Escape path persists the seen state.

Do not remove the plugin, disable vision, change CSS, remove inert, or force-click the background to hide the guidance. Selecting a workspace may create a session using its default mode. Bind the intended workspace first, then explicitly select Ultimate-Model and verify that session's actual composition.

## Uninstall, restore, and runtime health

Use official `remove_bundle`, then check whether independent Home registrations remain. Uninstalling the bundle does not delete user experience/checkpoint stores or later-added content. Restore by comparing the current preimage with the relevant backup. Keep recovery data on conflict; do not replace later user updates with a whole old snapshot. Arrange a confirmed maintenance window before a restart that can affect active work.

The accepted deployment/cleanup snapshot and later runs must remain separate. The preceding run recorded a clean end at 00:13:07.396 UTC; a later run started at 2026-11-07T00:13:13.189Z. It had the same static manifests/configuration and three startup health events, but a read-only snapshot at 00:25:04.281 UTC also recorded 12 errors: 1 account-read renderer error, 10 OTHER renderer errors, and 1 host.session error. The bounded technical classification is complete. It found no explicit UM/jizhi, module-load, broken, EPERM, authentication, rate-limit, owned-path, or owned-session markers, but error name/code/HTTP status could not be extracted. The cause remains **UNDETERMINED**; absent markers do not exclude a relationship. The check did not read chats, journals, or account contents and did not restart DSH. Do not infer who initiated the earlier restart, call the current run error-free, or explain every later error as the previously known account entry. Startup health and unchanged files do not establish healthy account/session behavior; see the [snapshot boundary](acceptance.md#runtime-snapshots-and-later-observations) and investigate only within the authorized scope.

Only the recorded Windows x64 scope was exercised. Other platforms and installation modes remain subject to their own acceptance. Workflow guidance and finite tool guards cannot replace project permissions, version control, backups, ownership checks, and review of actual edits. A successful interception test does not establish that every script, deletion, or logic error is controlled.
