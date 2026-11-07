# DSH-Optimization

**Goal-directed work, on-demand capabilities, and evidence-backed delivery for DSH.** 让DSH按目标推进，按需使用能力，把结果和证据一起交付。

[![Version](https://img.shields.io/badge/version-0.1.4-blue.svg)](VERSION)
[![Plugin](https://img.shields.io/badge/Ultimate--Model-1.4.3--review.7-blue.svg)](packages/ultimate-model/package.json)
[![Node](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![Verified platform](https://img.shields.io/badge/verified-Windows%20x64-lightgrey.svg)](docs/acceptance.md)

[English](#english) | [简体中文](#简体中文)

## English

[Downloads](#downloads-and-packages) · [Install](docs/en/getting-started.md) · [Use](docs/en/usage.md) · [Acceptance](docs/en/acceptance.md) · [History](docs/en/changelog.md)

DSH-Optimization is a community toolkit for DeepSeek Harness / DSH NEXT. It provides an explicitly selected **Ultimate-Model preset** and an optional **shared workflow block** for modes that read your DSH Home rules. Methods from [Qoder-Optimization](https://github.com/liushikuan63/Qoder-Optimization)—on-demand discovery, recoverable changes and checkable delivery—are adapted to DSH's actual SDK, plugin manager and existing skills.

### Downloads and packages

Start with the **full share pack**; cloning is optional. The current release is **v0.1.4, a pre-release**. The component is **1.4.3-review.7**, a metadata-only compatibility revision with unchanged review.6 execution code. Both archives have separate SHA256 sidecars.

| Download | Contents | Choose this when |
| --- | --- | --- |
| [Full share pack](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/DSH-Optimization-0.1.4.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/DSH-Optimization-0.1.4.zip.sha256) | Plugin, optional workflow installer and Bili compatibility utility, bilingual README and English/Chinese setup, use, recovery, history and acceptance guides; tests and sanitized evidence | Installing for the first time, sharing with others, or adding shared rules across modes |
| [Plugin only](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/Ultimate-Model-1.4.3-review.7.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/Ultimate-Model-1.4.3-review.7.zip.sha256) | The frozen Ultimate-Model component and its original package documentation | You only need the preset and already manage shared rules; use the linked English guides online |

[Release notes](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v0.1.4) · [All releases](https://github.com/liushikuan63/DSH-Optimization/releases) · [Changelog](docs/en/changelog.md)

GitHub's automatic Source code downloads are source snapshots. Use the named release assets above for the exact audited bytes and sidecars. Published archives and tags are immutable; changes ship in a new version. The full pack contains the bilingual user guides. Original skill bodies and third-party component documents retain their source languages and notices.

### What it helps with

| Need | Included approach | Boundary |
| --- | --- | --- |
| Keep working toward a complete result | Goals, completion criteria, next actions, staged checks and VibeCoding task records | Guides model behavior; user cancellation and current authorization remain effective |
| Use relevant skills without loading everything | core/library/local metadata; the current model selects USE / SKIP / ASK / NEEDS_FACTS, then reads needed bodies | Keywords recall candidates; no extra resident classifier or model request |
| Preserve existing work | Ownership and preimage checks, read-before-edit, backups, recoverable metadata transactions and covered tool guards | Guards cover finite patterns; keep project permissions, backups and version control |
| Make completion claims checkable | Actual commands, exits, test/failure/skip counts and positive/negative controls | Static, fixture, live model, installed host and release-byte evidence stay separate |
| Clarify complex requests and improve prompts | Existing intent-clarification, vibe-coding and verify-before-claim workflows | Resolve material gaps; continue routine authorized work without repeated approval |
| Coordinate parallel work | Owned paths, dependency order, a single integrator and integrated validation | Uses actual host tools; arbitrary concurrent writes are not universally verified |
| Respect a no-persistence request | Explicit no-disk instructions constrain automatic saves and related persistence tools | Quotes, tool output and old history do not create new permission |
| Diagnose overlays and EPERM | Normal modal dismissal; bounded metadata retries with ownership checks; separate Node subprocess diagnostics | See recovery guidance; no forced click-through, ACL relaxation or unbounded retry |

The component contains **55 skills and 25 plugin-configuration rows**. These are distribution counts, not 55 always-resident skills or 25 newly created standalone plugins. Preset ID `ultimate-model` and public `jizhi_*` tool names remain compatible.

### Get started

Requirements: an installed compatible DSH, core **>=0.2.1-rc.2 <0.2.2-0**, and **Node.js 22+**. Actual acceptance used Windows x64, DSH NEXT 2.0.20-next / core 0.2.1-rc.3 and Node24. Other declared versions and platforms were not individually verified.

1. Download the ZIP and sidecar from a trusted release, compare SHA256 and extract to a directory you will keep.
2. In the final plugin directory, run `node scripts/prepare-install.mjs --check`, then `node scripts/prepare-install.mjs` to materialize its actual resource paths.
3. Have DSH read the component's `INSTALL-AI.md`, inspect existing bundles and same-ID overrides, and install the absolute plugin directory through the official `plugin_manager.install_bundle` capability.
4. Check `application`, warnings and pending builds. Arrange a maintenance window if adoption requires a restart. Bind the target workspace, then explicitly select **Ultimate-Model** for that session.
5. For optional shared rules, run `node scripts/install-workflow.mjs --home "<ABSOLUTE_DSH_HOME>"` from the full-pack root to preview, then apply the correct plan with `--apply`. Original bytes are backed up and preserved; differing or customized blocks return `REVIEW_UPDATE`.

**The tested local-directory install is a link: keep the source directory after installation.** Do not delete the extracted directory, copy Qoder installation commands, replace your whole Home or hand-edit the profile. Exact commands, an assistant-facing install request and completion checks are in [Getting started](docs/en/getting-started.md).

Try a small owned workspace before relying on a larger project. Ask DSH to state the goal, create a small function and test, execute it, record the exit and verify protected files. [Usage](docs/en/usage.md) includes long-task, skill selection, prompt, parallel-work and no-persistence examples. Real model use consumes your existing account allowance.

### What was actually verified

**The third controlled autonomous continuation passed.** Within an additional 20-main-request / 300-second allowance, the model used 11 requests and 103.662 seconds. Starting from two existing DSH-authored code files, it ran tests, injected and restored a fault, completed VIBECODING and ended normally. The coordinator supplied no mid-run prompt or artifact edits. Independent verification passed 13 tests plus 5 positive and 18 invalid-input cases; the original three protected files retained bytes, hashes and mtimes.

| Layer | Result | Scope |
| --- | --- | --- |
| Frozen plugin regression | 311 pass; 0 fail/cancel/skip/todo | Independently unpacked final review.6 ZIP |
| Shared workflow / existing host guard | 16 / 27 tests passed | Isolated workflow installer / host-guard regression |
| Original SDK, Host/UI, official manager | Passed | Normal modal and mode selection, real tools, stop, no-persistence and refresh; deterministic offline model fixture |
| UM6 local deployment | Passed on recorded review.6 bytes | Exact version/manifest, backups, rule adoption, normal restart and boot-event readback |
| Review.7 metadata / official manager | Exact ZIP: 5 metadata changes / 210 identical files; supported-SDK install/enable/disable/remove passed | core0.2.1-rc.3, isolated profile; activation requires restart, no new model run |
| Optional Bili repair | 7 unit + 15 portable fixture cases; formal browser10/gate14 passed | Exact supported source, actual local service and native dsh-app readable404; account403 remains unresolved |
| Real model continuation | Third run 11/20, normally completed | Actual RED→GREEN, complete ledger and independent retest; prior failures retained |

v0.1.4 adds optional byte-pinned Bili CORS and desktop footer repair tools. Component review.7 changes five metadata/document files to exclude core 0.2.2 prereleases and later versions; its other 210 files, including all execution code, are byte-identical to review.6. The existing workflow installer/overlays and guards retain their bytes. New utilities and compatibility metadata have separate current checks. Unchanged plugin regression/SDK/UI suites are not presented as rerun for this repair. The first two real trials used six requests each and remain failed records, so the three-run total is 23 SDK main requests. Provider-internal HTTP retries and the actual bill were not counted. Temporary test plugins and caps were removed; normal DSH has no six- or twenty-request limit from this acceptance.

Default Node test subprocesses can still report `spawn EPERM` inside the DSH read-only sandbox; the same single-file test passed via same-process execution. This is not a universal replacement for isolation-dependent suites. The twelve later error records are now classified: one official profile HTTP403, ten Bili status polling CORS errors, and one expected unbounded-read denial followed by successful bounded reads. A trusted-status 400/404 header omission was reproduced; the historical ten response statuses were not recorded. Actual local repair, a fresh proxy process and native dsh-app reading the empty-session404 are verified. One normal account RPC still encounters upstream profile403 and is unresolved. Configuration/data hashes match the backups; a confirmed footer width/callback defect was repaired, but the actual running window still reports periodic ResizeObserver notifications and fails the zero-notification gate. Healthy boot events do not prove every account, session or console is error-free.

See [Acceptance](docs/en/acceptance.md), [Real-model records](docs/en/real-model-validation.md) and the [sanitized machine summary](docs/evidence/acceptance-summary.json). Cross-platform behavior, arbitrary fresh business projects, long-term model reliability, arbitrary parallel writes and all external plugin combinations remain unverified.

### Optional Bili runtime repair

If the installed component is exactly supported `billion-context@0.1.212`, [runtime diagnosis and repair](docs/en/runtime-repairs.md) explains the trusted 400/404 CORS header fix, preview/apply, permanent backup, hardlink handling and safe restore. Other versions or local changes return REVIEW_UPDATE. The utility never starts/stops DSH, invokes models, reads account values or changes provider/configuration. It is optional; installing billion-context is not a prerequisite for Ultimate-Model.

The utility adapts header logic from [billion-context](https://github.com/ranxianglei/billion-context), by ranxianglei. Its license includes MIT text and an additional attribution term; the [complete notice](docs/third-party/billion-context.LICENSE.txt) is retained.

### Documentation

| Need | English | 简体中文 |
| --- | --- | --- |
| Install and perform first checks | [Getting started](docs/en/getting-started.md) | [首次安装](docs/getting-started.md) |
| Use skills and complete tasks | [Usage](docs/en/usage.md) | [使用指南](docs/usage.md) |
| Upgrade, diagnose and roll back | [Deployment and recovery](docs/en/deployment.md) | [部署与恢复](docs/deployment.md) |
| Understand versions and release gates | [Changelog](docs/en/changelog.md) | [更新记录](docs/changelog.md) |
| Inspect acceptance and limits | [Acceptance](docs/en/acceptance.md) | [验收报告](docs/acceptance.md) |
| Inspect the three real-model trials | [Real-model validation](docs/en/real-model-validation.md) | [真实模型记录](docs/real-model-validation.md) |
| Classify runtime errors and apply the optional Bili repair | [Runtime repair](docs/en/runtime-repairs.md) | [运行修复](docs/runtime-repairs.md) |

Original component [capabilities and protocol](packages/ultimate-model/README.md), [shared-rule installer contract](overlays/README.md), [sources](packages/ultimate-model/SOURCES.md) and [third-party notices](THIRD-PARTY-NOTICES.md) are also distributed.

### Maintenance, feedback and licensing

Keep versioned source separate from installed runtime copies. Compare trusted old, installed and new versions before upgrades, preserving local customization. The build collects only public whitelisted paths; it does not export user Home, accounts, private rules, experience/checkpoint stores, node_modules, journals or temporary acceptance helpers. Release from fixed source, independently check the archive, then download and compare published bytes.

For issues, include DSH/core/Node versions, minimal steps, expected and observed behavior and sanitized logs. Provide both allowed and denied examples for guard changes. Do not publish credentials, tokens, complete personal configuration or private sessions.

This is a community adaptation, not an official DSH, Qoder or OpenAI release. The original attachment did not supply a single license covering all content; making this repository public does not relicense the whole source. Third-party components and adapted methods retain their sources and applicable licenses; see [notices](THIRD-PARTY-NOTICES.md).

---

## 简体中文

[下载](#下载与选包) · [安装](docs/getting-started.md) · [使用](docs/usage.md) · [验收](docs/acceptance.md) · [更新](docs/changelog.md)

这是面向 DeepSeek Harness / DSH NEXT 的社区优化包，包含显式选择的 **Ultimate-Model 预设**，以及可选的**通用工作规则**。参考 [Qoder-Optimization](https://github.com/liushikuan63/Qoder-Optimization) 的按需能力、可恢复修改和证据驱动交付方法，按 DSH 的实际 SDK、预设、插件管理器与现有技能适配。

### 下载与选包

首次使用推荐下载**完整分享包**，无需克隆仓库。当前版本为 **v0.1.4 预发布**；插件为兼容边界元数据修订版 **1.4.3-review.7**。完整包带版本化顶层目录，两个 ZIP 都有独立 SHA256 文件。

| 下载 | 包含内容 | 适合谁 |
| --- | --- | --- |
| [完整分享包 ZIP](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/DSH-Optimization-0.1.4.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/DSH-Optimization-0.1.4.zip.sha256) | 插件、通用工作规则安装器、可选Bili兼容修复、双语使用文档、测试与验收摘要 | 首次安装、分享给他人，或希望各模式采用通用工作规则 |
| [独立插件 ZIP](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/Ultimate-Model-1.4.3-review.7.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.4/Ultimate-Model-1.4.3-review.7.zip.sha256) | 仅 Ultimate-Model 及其自带技能、脚本、清单和说明 | 已有独立工作规则，只需安装或更新该预设 |

[本版发布说明](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v0.1.4) · [全部版本](https://github.com/liushikuan63/DSH-Optimization/releases) · [历史记录](docs/changelog.md)

GitHub 自动生成的 Source code 是源码快照；需要本轮固定字节、测试关联和配套校验文件时，选择上表明确命名的资产。已发布 ZIP 和 tag 保持不变，后续修复发新版本。

### 能改善什么

| 你关心的问题 | 包内做法 | 使用边界 |
| --- | --- | --- |
| 做到一半丢目标、把进度当完成 | 目标、完成条件、下一步与验收证据；长/复杂任务沿用 VibeCoding 文档 | 规则指导模型；用户停止和授权范围继续有效 |
| 技能很多但不用，或上下文太重 | core/library/local 三层索引；当前模型做 USE / SKIP / ASK / NEEDS_FACTS 判断，按需读正文 | 关键词只召回候选；不增加常驻分类模型 |
| 修改前不看现状、误改已有内容 | 归属与预像检查、读后编辑、备份、可恢复元数据事务、已覆盖风险的工具守卫 | 守卫覆盖有限形式，项目权限和版本控制仍需保留 |
| 测试没跑却报告成功 | 分段验证、真实命令/退出码/失败与跳过计数、正反对照 | 静态、fixture、真实模型、实装与远端字节分别验收 |
| 复杂需求和提示词不清 | 复用意图澄清、提示词优化、vibe-coding 与 verify-before-claim | 明确任务继续执行；关键缺口才澄清 |
| 并行操作互相覆盖 | 文件归属、依赖顺序、唯一集成者与合并后验证 | 复用宿主实际能力；未承诺任意多代理写入无冲突 |
| 明确不保存却留下经验/快照 | 明确“不落盘”同时约束自动保存和相关持久工具 | 不把工具结果、引用或旧历史当作新授权 |
| 模式被浮层挡住、偶发 EPERM | 正常处理模态引导；元数据有限重试与归属复核；区分测试子进程限制 | 详见[排障与恢复](docs/deployment.md)，不改权限或强行穿透浮层 |

包内有 **55 个技能、25 行组合插件配置**；这些是分发结构数量，不表示55项技能每轮常驻或25个全新独立插件。公开预设 id 为 `ultimate-model`，工具名称 `jizhi_*` 保持兼容。

### 首次上手

前置是已安装兼容 DSH：core **>=0.2.1-rc.2 <0.2.2-0**、Node.js **22+**。本轮真实验证环境为 Windows x64、DSH NEXT 2.0.20-next / core 0.2.1-rc.3；声明范围中的其他版本和其他平台未逐一验证。

1. 下载 ZIP 与对应 `.sha256`，核对可信发行来源和文件哈希，解压到长期保留的目录。
2. 在最终插件目录先运行 `node scripts/prepare-install.mjs --check`，再运行 `node scripts/prepare-install.mjs`，生成当前位置的实际资源路径。
3. 让 DSH 先读包内 `INSTALL-AI.md`，检查现有 bundle 与同 id 注册，再用官方 `plugin_manager.install_bundle` 安装这个插件目录的绝对路径。
4. 按管理器的 `application`、warnings、pendingBuilds 判断是否采用；需要重启时安排维护窗口。新任务先绑定目标工作区，再显式选择 **Ultimate-Model**。
5. 如需各模式的通用工作规则，在完整包根运行 `node scripts/install-workflow.mjs --home "<DSH_HOME绝对路径>"` 查看计划，再按计划加 `--apply`。个人原文先备份并保留；不同或定制受管块返回 `REVIEW_UPDATE`，不直接覆盖。

**本轮官方本地目录安装采用 link，安装后请保留原目录。** 不要安装后删除解压目录，也不要套用 Qoder 的安装命令、覆盖整个 Home 或手写 profile。具体命令、安装给 AI 的任务描述和完成检查见[首次安装指南](docs/getting-started.md)。

安装后可在自己新建的小型工作区先验证一次：让 DSH 写明目标、创建一个小函数和测试、实际运行测试、记录退出码并核对保护文件。示例和长任务用法见[使用指南](docs/usage.md)；真实模型会消耗你的现有额度。

### 本版实际验证了什么

**第三轮受控自主续任务完整通过。** 在新增20次主请求/300秒预算内，模型使用11次、103.662秒，从前轮已有的两份DSH代码继续，实际完成13项测试、故障注入→恢复、VIBECODING文档和最终交付；运行中没有协调者追加提示或代写产物。独立复测13/13，另5个正例+18个非法输入用例通过，原3个保护文件的字节、哈希和mtime均未变。

| 验证层 | 结果 | 证据范围 |
| --- | --- | --- |
| 冻结插件回归 | 311 pass，0 fail/cancel/skip/todo | 最终review.6插件ZIP独立解包后执行 |
| 全局工作规则 / 本机原守卫 | 16 / 27 项通过 | 隔离规则安装测试 / 本机守卫回归 |
| 原装 SDK、Host/UI、官方管理器 | 通过 | 模态、模式选择、真实工具、停止、禁存、刷新；模型为离线fixture |
| UM6本机部署 | 已验review.6相同字节通过 | 精确版本/清单、备份、规则采用、正常重启及健康事件读回 |
| review.7元数据 / 官方管理器 | 精确ZIP：5项元数据变化/210文件相同；支持SDK安装/启用/停用/卸载通过 | core0.2.1-rc.3隔离profile；仍需重启采用，未新增真实模型轮次 |
| 可选Bili修复 | 7回归+15便携夹具、正式浏览器10/门禁14通过 | 精确支持源、本机实际服务和原生dsh-app读取404；账号403仍未解决 |
| 真实模型自主续任务 | 本轮11/20，正常completed | 模型实际RED→GREEN，文档齐备，独立复验；前两轮失败保留 |

0.1.4增加严格限定字节的可选Bili CORS和桌面footer修复工具；插件review.7只改5个元数据/说明文件，明确排除core 0.2.2预发布版及后续版本，其余210文件（全部执行代码）与review.6相同。原有工作规则和守卫保持字节；新工具及兼容边界另做当前验证，不把未变插件的全套回归说成本次重跑。前两轮各6次失败仍保留，三轮累计23次SDK主请求；内部HTTP重试次数和实际账单未统计。临时验收插件和上限已清理，正常DSH没有6次或20次限制。

默认Node测试子进程在DSH只读沙箱内仍可报 `spawn EPERM`，本次同一单测试文件采用同进程路径完整通过；不能推广到所有测试套件。后续12条运行日志现已分成三类：1条官方profile HTTP403、10条Bili状态轮询CORS、1条预期无界读取拒绝且随后有界读取成功。可信状态400/404缺头已复现，历史10条的具体HTTP状态未记录；本机正式应用、新proxy进程及原生dsh-app读取空会话404已验证。正常账号RPC仍遭上游profile403，未解决；配置/数据哈希与备份一致，已确认的footer宽度/回调缺陷完成定点修复；实际现役窗口仍出现周期性ResizeObserver通知，零通知门禁失败，继续追查且不吞错。启动健康不代表所有账号、会话或控制台无错误。跨平台、真实业务长任务、任意并行写入和所有第三方插件组合仍未验。

完整命令、首红、修复、独立验收及限制见[验收报告](docs/acceptance.md)、[真实模型记录](docs/real-model-validation.md)和[机器可读摘要](docs/evidence/acceptance-summary.json)。一次小型续任务通过不构成任意模型永不犯错的保证。

### 可选 Bili 运行修复

仅当已安装的 `billion-context@0.1.212` 与支持字节完全一致时，按[运行诊断与修复](docs/runtime-repairs.md)预演/应用可信400/404响应头修复，保留永久备份并支持安全回退。其他版本或本地改动返回REVIEW_UPDATE，不自动覆盖。工具不启动/停止DSH、不调用模型、不读取账户值、不改变配置或provider；没有该组件的用户无需为Ultimate-Model安装它。

兼容工具使用 [billion-context](https://github.com/ranxianglei/billion-context)（作者ranxianglei）的响应头逻辑；其许可含MIT文本与额外出处标注条款，[完整声明](docs/third-party/billion-context.LICENSE.txt)已保留。

### 文档导航

| 需要 | 入口 |
| --- | --- |
| 下载后安装、校验、首次检查 | [首次安装](docs/getting-started.md) |
| 长任务、按需技能、提示词、并行和不落盘示例 | [使用指南](docs/usage.md) |
| 已有配置升级、EPERM、模态、卸载和回退 | [部署与恢复](docs/deployment.md) |
| 运行错误分类、Bili修复、便携验收与恢复 | [运行修复](docs/runtime-repairs.md) |
| 包内能力入口和检索协议 | [插件README](packages/ultimate-model/README.md) |
| 全局工作规则安装器及退出码 | [通用工作规则](overlays/README.md) |
| 版本变化与维护者构建发布流程 | [更新记录](docs/changelog.md) |
| 独立实装与真实模型证据 | [验收报告](docs/acceptance.md) |
| 第三方来源和许可范围 | [第三方声明](THIRD-PARTY-NOTICES.md) · [插件来源](packages/ultimate-model/SOURCES.md) |

### 维护、反馈与许可

源码用于维护，已安装副本用于运行；升级先比较可信旧版、当前安装与新版，保留本地定制。构建器仅收集公开白名单，不读取用户Home，不打包账号、私有规则、经验/检查点库、node_modules或临时验收辅助。维护者按[固定源码→独立实装/字节核对→发布后下载复核](docs/changelog.md#维护者发布流程)交付。

欢迎提交问题和改进。请附DSH/core/Node版本、具体步骤、预期与实际结果、脱敏日志及是否发生在隔离工作区；涉及拦截逻辑时同时给出应拒绝和应允许的例子。请勿上传账号、token、完整个人配置或私有会话。

本项目是社区适配，不代表DSH、Qoder或OpenAI官方。原始附件没有覆盖全部内容的统一许可证，Public不等于将全部源码重新许可；js-yaml、工具分页组件及借鉴方法各自保留来源与许可。详见[第三方声明](THIRD-PARTY-NOTICES.md)。
