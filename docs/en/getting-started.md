[简体中文](../getting-started.md) | **English**

# First installation and checks

Start with the full distribution, install the plugin, and then choose whether to add the optional global workflow. This guide uses only entry points provided by this package. It does not install DSH itself, model accounts, MCP services, or Qoder components.

You need a compatible DSH installation: core **>=0.2.1-rc.2 <0.3.0**, with **Node.js 22+**. The recorded environment is Windows x64, DSH NEXT 2.0.20-next / core 0.2.1-rc.3, and Node 24. Other versions within the declared range and other platforms have not each been verified.

## 1. Choose, verify, and place the package

Download `DSH-Optimization-0.1.3.zip` and its matching `.zip.sha256` file from [this release](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v0.1.3). If you only need the preset, choose the standalone `Ultimate-Model-1.4.3-review.6.zip`. That standalone archive does not contain the root-level global-workflow installer or this guide; follow its own README and INSTALL-AI instead.

In Windows PowerShell, run these commands from the download directory:

```powershell
Get-FileHash -LiteralPath '.\DSH-Optimization-0.1.3.zip' -Algorithm SHA256
Get-Content -LiteralPath '.\DSH-Optimization-0.1.3.zip.sha256'
node --version
```

Compare the 64 hexadecimal digits; letter case does not matter. Stop if the hashes differ. The checksum checks download consistency; the download source and the entry script itself must still be trusted independently. Node 22 is the minimum; the recorded tests used Node 24. You do not need to clone the repository or install extra dependencies to run prepare or the workflow installer.

Extract the full distribution into a directory you intend to keep, on any writable local drive. Quote paths that contain spaces. Do not extract over an existing installation. The layout should include:

```text
DSH-Optimization-0.1.3/
  README.md
  VERSION
  docs/                         # Installation, usage, recovery, acceptance, and history
    en/                         # Core documentation in English
  overlays/                     # Optional global workflow and its instructions
  scripts/install-workflow.mjs   # Read-only plan / explicit application
  scripts/build-release.py       # Maintainer build tool, not an installer
  packages/ultimate-model/       # Complete plugin directory for the official DSH manager
    INSTALL-AI.md
    FILES.sha256
    cordis.patch.template.yml
    scripts/prepare-install.mjs
```

The SDK used for the recorded local-directory installation selected `link`: the manager continues to use the supplied directory. Choose its final location before installing and keep it afterward. If you move it, prepare the package again and inspect the actual bound path.

## 2. Prepare the plugin

Start in the extracted full-distribution root. Replace the placeholder below with your own actual absolute path:

```powershell
Set-Location -LiteralPath '<ABSOLUTE_FULL_DISTRIBUTION_ROOT>'
Set-Location -LiteralPath '.\packages\ultimate-model'
node scripts/prepare-install.mjs --check
node scripts/prepare-install.mjs
node scripts/selfcheck.mjs
```

For the standalone plugin ZIP, enter its extracted `ultimate-model` directory and run the last three commands. Each should exit with code 0. `--check` verifies integrity and resources without writing. The second command generates literal absolute paths and the corresponding manifest only inside this plugin copy; it does not modify the DSH profile. The third command performs static self-checks. Materialization intentionally changes the patch and manifest, so those files no longer match the distributed source bytes. This expected change does not mean the original ZIP is damaged.

## 3. Install with the official DSH manager

You can give DSH the following task, replacing the plugin-directory placeholder:

> Read `<ABSOLUTE_PLUGIN_DIRECTORY>/INSTALL-AI.md`. First inspect the current core version, installed bundles, same-id Home/profile overrides, local customizations, and disabled items. Run this package's prepare command only in that directory, then install the directory with the official `plugin_manager.install_bundle`. Preserve my personal Home, accounts, models, MCP configuration, other bundles, and experience data. If a conflict affects correctness, recovery, or authorization, describe the proposed resolution first; continue with normal reversible preparation. Use `application`, `warnings`, and `pendingBuilds` to explain whether the running process has adopted the installation. Before any required restart, confirm that the current task can be interrupted. Finish by checking the package and reading back the actual preset and tools. Report anything not executed as unverified.

Discover tool names from the host's actual catalog; do not invent an API from the names in this guide. An official installation can report `restart-required/no-hmr`. Written files, a list entry, or passing tests alone do not prove that the running process has reloaded the package.

After a normal restart in an agreed maintenance window, bind the target workspace and explicitly select **Ultimate-Model**. Installation does not force a different default mode on existing sessions. If an overlay blocks the page, complete the official preview notice and Vision Router onboarding normally; see [deployment and troubleshooting](deployment.md).

## 4. Optional: use the global workflow across modes

To apply shared guidance for goals, staged acceptance, VibeCoding, and file ownership across modes, run the following from the **full-distribution root**. `--home` must identify your intended, existing DSH Home by an absolute path. Do not copy someone else's machine path:

```powershell
node scripts/install-workflow.mjs --home '<ABSOLUTE_DSH_HOME>'
node scripts/install-workflow.mjs --home '<ABSOLUTE_DSH_HOME>' --apply
node scripts/install-workflow.mjs --home '<ABSOLUTE_DSH_HOME>'
```

Inspect the first read-only plan. Run the second command only when its target and plan are correct. The first append reports `APPEND` and saves a complete backup of the original file before changing it; the third command should report `KEEP`. A different or customized existing managed block produces `REVIEW_UPDATE`, exits with code 3, and writes nothing. Compare and merge it manually; do not delete the block or force an overwrite to bypass the check. The installer maintains only the managed block in AGENTS. It does not change the default preset, model, accounts, or hook registrations. See the [workflow-installer instructions](../../overlays/README.md) for its complete behavior and exit codes.

## 5. Check that first use is complete

| Check | Evidence of success |
| --- | --- |
| Distribution source and bytes | Downloaded from a trusted release; ZIP hash matches its sidecar |
| Plugin copy | Prepare and selfcheck exit with code 0; actual resource paths exist |
| Host adoption | No unresolved installation errors; after any required restart, the current session actually selects Ultimate-Model |
| Existing configuration | Local customizations, disabled items, accounts, models, other bundles, and personal data remain intact |
| Optional global workflow | Backup and original-byte checks succeed; the final read-only plan is `KEEP`; adoption by a new task is verified separately |
| Real small task | Actual read/write/test execution in your own new workspace, with artifacts and protected files inspected; a model's completion claim alone is insufficient |

A real-model task uses your existing account allowance. Start with the bounded example in the [usage guide](usage.md) to check your own client path. The local acceptance evidence in this repository covers only its recorded machine, versions, and task.

For updates, removal, and rollback, read [deployment and recovery](deployment.md). Remove the plugin through the official `remove_bundle`; do not delete personal experience or checkpoints. Before restoring a backup, compare changes made since installation and restore only the appropriate changes, preserving later user edits.