[运行修复](runtime-repairs.md) · [Runtime repairs](en/runtime-repairs.md)

# 精确运行修复器 / Exact runtime stability utility

这是一项可选、默认只预览的精确版本修复。它组合 footer、输入栏 ResizeObserver 动画帧调度、安全 HTTP403 分类、Cordis 消费者生命周期和 standing subagent 子作用域清理。后两项都有原装核心反例与局部回归；不整体升级 SDK，不隐藏真实重复注册或清理失败。账号请求仍然失败，Host ACK 尚未恢复，不能把隔离测试当作这些现役门禁通过。

This optional, preview-first repair combines footer layout, animation-frame scheduling for the input control row, safe HTTP403 classification, Cordis consumer lifetime and standing-subagent child-scope cleanup. The lifetime changes have original-core counterexamples and focused regressions. They do not upgrade the SDK, hide genuine duplicates or swallow cleanup failures. Account requests still fail and native Host ACK remains unresolved; isolated tests do not pass those live gates.

## Supported inputs / 支持范围

仅支持以下完整 SHA256；版本名称本身不能代替字节验证。EXE 必须与 `resources/app.asar` 属于同一安装目录，两者均为单硬链接文件，EXE 的既有 ASAR integrity fuse 必须已经停用。工具不改 EXE、fuse、unpacked 文件、配置、账号数据或业务数据。未知版本、本地改动、错配安装目录、硬链接和不符的 fuse 保持原样，返回 `REVIEW_UPDATE`。

Only the complete SHA256 values below are supported. A version label alone does not establish compatibility. The EXE and `resources/app.asar` must belong to the same installation, both files must have one hard link, and the EXE's existing ASAR integrity fuse must already be disabled. The tool does not change the EXE, fuse, unpacked files, configuration, account data, or business data. Unknown bytes, local changes, mismatched installations, hard links, or a different fuse state are preserved as `REVIEW_UPDATE`.

| Input / 输入 | SHA256 |
| --- | --- |
| EXE | `af7bb5a976c658fef1627743943599053ee47316e668e2fd0ac053ece5d8dcc5` |
| Original ASAR / 原装 ASAR | `54983f84d351499c90a5be50957065d9bd8b5188c30fc85eb0c67ef2eba0354e` |
| Existing footer ASAR / 已修 footer ASAR | `1c3bc0c92100688532e43173e51d93bcc07350dbcb18a9be65e5346504203fe4` |
| Previous runtime / 旧运行时 | `e8a0fcbcafb0127e4005ed0cebd56568c6a46a56f20ed4bdb4e8b8316bf1815b` |
| Previous R2 / 旧 R2 | `90c23c91ddff8e1306cfeb17e4546e8e3e708721dd2fba5a82500d6655dc8f88` |
| Repaired ASAR / 修复后 ASAR | `13a1ede091885c497bf7833464be356a649c19b243051fdfa394cadd21213210` |

四种输入均生成同一193654185字节完整ASAR。549先加入footer再追加四项；1c3追加四项；e8追加Cordis和subagent两项；90仅追加subagent；13a返回KEEP。转换只处理数据，不加载应用模块，保留旧payload和非目标header/unpacked条目，验证完整与分块integrity、连续尾部及整文件SHA256。只分发短转换器；完整模块、ASAR和诊断探针不分发。来源与许可见[第三方声明](../THIRD-PARTY-NOTICES.md)。

All four inputs produce the same 193,654,185-byte ASAR. Original549 receives the footer conversion plus four runtime entries; footer1c3 receives four; e8 receives Cordis and subagent;90 receives only subagent. Exact13a returns KEEP. Transformations process data without importing app modules, preserve the old payload and unrelated header/unpacked entries, and verify full/block integrity, contiguous append layout and whole-file SHA256. Only short transforms are distributed; complete modules, ASARs and private probes are excluded. See [third-party notices](../THIRD-PARTY-NOTICES.md).

## Preview, apply, restore / 预览、应用与恢复

从仓库根目录运行 Node.js。以下路径是示例，必须替换为实际安装位置；所有路径参数均须为绝对路径。先运行预览并检查 JSON 结果。

Run Node.js from the repository root. Replace the example paths with the actual installation; all path arguments must be absolute. Start with a preview and inspect its JSON result.

```powershell
node scripts/repair-dsh-runtime-stability.mjs `
  --asar 'D:\Apps\DSH NEXT\resources\app.asar' `
  --electron-exe 'D:\Apps\DSH NEXT\DSH NEXT.exe'
```

计划为 `REPAIR` 时，先通过应用正常退出，并确认当前工作已保存。工具不停止或启动应用。选择安装目录之外、由自己管理并会长期保留的专用备份目录，再显式应用。备份和 receipt 不应随公开分享包分发。

When the plan is `REPAIR`, save current work and quit the application normally. The tool never stops or starts the app. Select a dedicated, permanent backup directory outside the installation and explicitly apply. Backups and receipts are local recovery material and should not be distributed in a public share pack.

```powershell
node scripts/repair-dsh-runtime-stability.mjs `
  --asar 'D:\Apps\DSH NEXT\resources\app.asar' `
  --electron-exe 'D:\Apps\DSH NEXT\DSH NEXT.exe' `
  --backup-dir 'D:\DSH-Recovery\runtime-stability' `
  --apply
```

保留输出的 `backup`、`beforeReceipt` 与 `receipt`。恢复须使用该次成功应用生成的 `.committed.json` receipt，先预览，再追加 `--apply`。恢复同样要求应用正常退出。恢复校验该 receipt、原备份、安装目录和当前目标文件身份；即使后来替换的文件字节相同，只要身份不符也会拒绝，避免覆盖其他写入者的结果。

Keep the reported `backup`, `beforeReceipt`, and `receipt`. Restore requires the `.committed.json` receipt from that successful application. Preview first, then add `--apply`. Quit the app normally before restoration as well. Restore binds the receipt, original backup, installation, and current target identity. A later byte-identical replacement with a different file identity is also refused so that another writer's result is preserved.

```powershell
node scripts/repair-dsh-runtime-stability.mjs `
  --asar 'D:\Apps\DSH NEXT\resources\app.asar' `
  --electron-exe 'D:\Apps\DSH NEXT\DSH NEXT.exe' `
  --backup-dir 'D:\DSH-Recovery\runtime-stability' `
  --restore-receipt 'D:\DSH-Recovery\runtime-stability\dsh-runtime-stability-EXACT-ID.committed.json'
```

应用阶段仅在 Windows 提供停止检查：一个自有隐藏、只读 PowerShell helper 通过 `Get-Process` 检查进程，后续阶段以私有 request/ACK 检查新 PID 与进程身份。运行中的目标、不可读取或不明确的进程身份、以及同名但不同安装路径的进程均会阻止应用。非 Windows 缺少可靠停止检查时返回 PREREQ。helper 在父进程退出、停止标记或最多 120 秒时退出；每个检查阶段共用 2 秒 deadline。120 秒是 helper 的生命周期，不是所有操作系统文件 I/O 的全局硬时限；进程快照也不是阻止外部启动应用的原子锁。

Apply provides a stopped-app check on Windows using an owned hidden, read-only PowerShell helper and `Get-Process`. Subsequent phases use private request/ACK exchanges to inspect new PIDs and process identities. A running target, unreadable or ambiguous process identity, or another installation with the same process name prevents application. Non-Windows apply returns PREREQ when a reliable stopped-app check is unavailable. The helper exits on parent exit, a stop marker, or a maximum 120-second lifetime; each check phase shares a 2-second deadline. The 120 seconds bound the helper lifetime rather than all operating-system file I/O. Process snapshots are not an atomic lock against an external app launch.

## Failures and recovery / 失败与恢复

仅对私有检查通道中短暂的 `EPERM`、`EBUSY`、`EACCES` 做受限重读/重开，且每次重验目录、单链接、inode 与 FD 身份。ASAR 的 CAS、备份、receipt 和目标竞态门禁没有放宽，也不会盲目重试发布。永久备份在目标发布前完成；发布/恢复使用固定哈希的 metadata helper，以 data URL 加载，并校验目录和文件身份。

Only transient `EPERM`, `EBUSY`, and `EACCES` in the private checker channel receive bounded reread/reopen attempts, with directory, single-link, inode, and FD identities rechecked. ASAR CAS, backup, receipt, and target race guards remain strict; publication is not blindly retried. Permanent backup completes before target publication. Publication and restoration use a hash-pinned metadata helper loaded through a data URL with file and directory identity guards.

失败输出中的 `committed` 是恢复依据：`false` 表示尚未发布目标；`true` 表示已知发布完成；`"unknown"` 表示发布已开始但无法可靠确认，必须保留 `transaction` 中的备份、stage、journal 和 receipt，停止重试并人工核对当前目标哈希及记录。不要删除锁或 stage，不要把 `unknown` 当作未改动。若自有 helper 退出未确认，输出 `cleanupComplete:false` 并返回非零退出码，即使目标已经提交也不报告全流程成功。

Use the failure output's `committed` field for recovery: `false` means the target has not been published; `true` means publication is confirmed; `"unknown"` means publication began but cannot be confirmed reliably. Preserve the backup, stage, journal, and receipt listed in `transaction`, stop retrying, and reconcile the current target hash and records manually. Do not delete locks or stages, and do not interpret `unknown` as unchanged. If owned-helper termination is unconfirmed, `cleanupComplete:false` and a nonzero exit code remain visible even when target publication completed.

| Exit | Meaning / 含义 |
| --- | --- |
| `0` | Successful preview, KEEP, or confirmed apply/restore with cleanup / 预览、KEEP，或已确认应用/恢复及清理 |
| `1` | I/O, guard, transaction, or recovery failure; inspect JSON / I/O、门禁、事务或恢复失败，检查 JSON |
| `2` | Invalid or duplicate flags, relative paths, or missing required arguments / 参数、重复选项、相对路径或必填项错误 |
| `3` | REVIEW_UPDATE; preserve unsupported or changed files / 保留未知或已更改文件，待审查 |
| `4` | Stopped-app check prerequisite/running app, or unconfirmed checker cleanup / 停止检查前置条件不满足、应用运行中或 helper 清理未确认 |

## Acceptance evidence and limits / 验收证据与边界

R3工具单测 **11 pass / 0 fail / 0 skip**，五项语法检查通过。四种完整归档输入均生成同一13a实体；本轮在真实Windows文件系统上，使用精确EXE的自有副本（从未执行），通过真实CLI完成90→13a、KEEP、13a→90，45.214秒，所有命令exit0且cleanupComplete=true。其它三输入本轮执行完整字节转换与作用域验证，不冒充重复事务实装。此前e8事务及6个文件竞态、2个目录配对反例作为历史证据保留。

R3 has **11 passed / 0 failed / 0 skipped** unit tests and five successful syntax checks. All four full-size baselines generate the identical13a output. This round uses real Windows files and an owned exact EXE copy (never executed): the actual CLI completes90→13a, KEEP and13a→90 in45.214seconds, all exit0 with cleanupComplete=true. The other three baselines receive full-byte conversion and scope validation, not claimed repeat transaction installations. Earlier e8 transactions, six file-race cases and two directory-pairing negatives remain historical evidence.

subagent最终候选在原装与R4核心下各14/14；原装代码在两种核心均保留standing卸载反例RED。修复等待自己创建的子fiber完成清理，阻止退出中及异步校验迟到的再安装；真实duplicate仍拒绝，清理错误身份保留。这证明局部生命周期缺陷及修复，不证明它导致现役Host关闭失败。90已真实部署；新增13a在当前文档快照尚未部署，待不冲突的维护窗口。

The final subagent candidate passes14/14 on each original and R4 core; original source retains the standing-teardown RED on both. Cleanup awaits only owned child fibers, blocks shutdown re-entry and late validation installs, preserves genuine duplicate rejection and cleanup-error identity. This proves the scoped lifetime defect and repair, not causality for the native Host shutdown failure. Revision90 is deployed; the added13a change is not deployed in this documentation snapshot and awaits a conflict-free maintenance window.

上述是修复器及隔离副本的验收，不能代替现役 DSH 启动、模式交互、业务模型任务、官方账号恢复或长时间原生 ResizeObserver 验收。真实应用仍由维护窗口中的主任务单独验证。本候选未访问账号或网络，未发模型请求，未启停生产 DSH，也没有改动生产配置和数据。首次失败及中间失败保留为失败记录，后续通过未覆盖历史。早期某次 EBUSY 缺少 syscall/path，不能据此断言所有历史 EPERM 的来源。

These results verify the repair tool and isolated copies. They do not replace live DSH startup, mode interactions, business model tasks, official account recovery, or long-running native ResizeObserver acceptance. The main maintenance task verifies the live application separately. This candidate did not access accounts or the network, issue model requests, stop/start production DSH, or change production configuration or data. First-red and intermediate failures remain recorded as failures. An earlier EBUSY attempt did not retain its syscall/path, so it does not establish the cause of all historical EPERM errors.
