# DSH-Optimization

**Goal-directed work, on-demand capabilities, and evidence-backed delivery for DSH.** 让 DSH 按目标推进，按需使用能力，把结果和证据一起交付。

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](VERSION)
[![Plugin](https://img.shields.io/badge/Ultimate--Model-1.5.0-blue.svg)](packages/ultimate-model/package.json)
[![Node](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![Verified platform](https://img.shields.io/badge/verified-Windows%20x64-lightgrey.svg)](docs/acceptance-1.1.0.md)

[English](#english) | [简体中文](#简体中文)

## English

DSH-Optimization is a community toolkit for DeepSeek Harness / DSH NEXT. It supplies an explicitly selected **Ultimate-Model preset**, optional **shared workflow rules**, and narrowly scoped repair utilities. Methods from [Qoder-Optimization](https://github.com/liushikuan63/Qoder-Optimization)—on-demand discovery, staged checks, recoverable edits and complete delivery—are adapted to the actual DSH SDK and existing skills. No additional resident classifier or model gateway is installed.

### Downloads and packages

The current community release is **v1.1.0**, with **Ultimate-Model 1.5.0**. Both archives have SHA256 sidecars and are built from a fixed Git commit, excluding local working files. See the release attachments for the source and archive verification records.

| Download / 下载 | Contents / 内容 |
| --- | --- |
| [Full share pack](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/DSH-Optimization-1.1.0.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/DSH-Optimization-1.1.0.zip.sha256) | Preset, shared workflow, optional repair tools, tests and bilingual guides |
| [Plugin only](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/Ultimate-Model-1.5.0.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/Ultimate-Model-1.5.0.zip.sha256) | Ultimate-Model component; no root-level repair/workflow tools |

[Release notes](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v1.1.0) · [All releases](https://github.com/liushikuan63/DSH-Optimization/releases)

GitHub's automatic Source code downloads are source snapshots. Choose the named assets for the audited distribution. Original skill bodies retain their source languages and notices; user-facing root guides and release notes are bilingual.

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

Requirements: a working DSH Host and **Node.js 22+**. The manifest uses `engines.dsh: "*"` and chooses the paging adapter by the Host's APIs. If neither API is available, this preset reports an error. Test new Host versions in a separate profile before adoption.

1. Download the ZIP and sidecar, verify SHA256, and extract to a directory you will keep.
2. In `packages/ultimate-model` of the full pack (or the standalone plugin root), run `node scripts/prepare-install.mjs --check`, then `node scripts/prepare-install.mjs` to materialize the final location.
3. Have DSH read `INSTALL-AI.md`, check existing bundles and same-ID overrides, and install the absolute component directory using official `plugin_manager.install_bundle`.
4. Check `application`, warnings and pending builds; arrange a maintenance window if adoption requires restart. Bind the workspace, then explicitly select **Ultimate-Model** for that session.
5. Optional shared rules: from the full-pack root, preview `node scripts/install-workflow.mjs --home "<ABSOLUTE_DSH_HOME>"`, then apply the reviewed plan with `--apply`.

The tested directory installation is a **link**: keep the source directory. Existing rules are backed up and retained; customized managed blocks require review. Follow [Getting started](docs/en/getting-started.md) rather than replacing your Home/profile or copying Qoder installation commands. [Usage](docs/en/usage.md) includes complex-task, prompt, skill-selection, parallel-work and no-persistence examples.

### Runtime repairs and acceptance

The isolated release check uses the installed DSH NEXT **2.0.24-next** / Harness **0.2.2-rc.5** on Windows x64. It verifies official link installation and removal, the standard and Ultimate Model session flows, and native tool paging against a local simulated provider. The first request kept the activation hints and omitted the paged families; a successful activation made the tools available on the next request. An activation in the same batch did not grant early access.

See [1.1.0 acceptance](docs/en/acceptance-1.1.0.md) for what was checked and what remains unverified. The exact-byte [runtime repair utilities](docs/en/runtime-repairs.md) from 1.0.0 remain optional and return `REVIEW_UPDATE` for unknown bytes. [Historical 1.0.0 evidence](docs/en/acceptance.md) applies only to that release.

### Documentation and maintenance

| Need / 用途 | English | 简体中文 |
| --- | --- | --- |
| Installation / 安装 | [Getting started](docs/en/getting-started.md) | [首次安装](docs/getting-started.md) |
| Skills, task delivery / 能力与交付 | [Usage](docs/en/usage.md) | [使用指南](docs/usage.md) |
| Updates and recovery / 升级与恢复 | [Deployment](docs/en/deployment.md) | [部署](docs/deployment.md) |
| Optional runtime repairs / 可选运行修复 | [Runtime repairs](docs/en/runtime-repairs.md) | [运行修复](docs/runtime-repairs.md) |
| Developer deadline API / 开发者限时接口 | [API](docs/en/diagnostic-deadline-api.md) | [API](docs/diagnostic-deadline-api.md) |
| Evidence and known issues / 验收与已知问题 | [Acceptance](docs/en/acceptance-1.1.0.md) | [验收报告](docs/acceptance-1.1.0.md) |
| Real model trials / 真实模型记录 | [Model validation](docs/en/real-model-validation.md) | [模型验收](docs/real-model-validation.md) |
| Version history / 版本历史 | [Changelog](docs/en/changelog.md) | [更新记录](docs/changelog.md) |

Keep trusted source separate from live copies; preserve local customization and review three-way differences before upgrades. The builder exports whitelisted public source, not Home/configuration, credentials, experience/checkpoints, sessions, private journals, binaries or diagnostic probes. Report issues with sanitized versions, steps, observed results and minimal logs.

This is a community adaptation, not an official DSH, Qoder or OpenAI release. Public visibility does not relicense the complete supplied content. See [third-party notices](THIRD-PARTY-NOTICES.md), [component sources](packages/ultimate-model/SOURCES.md) and retained licenses.

---

## 简体中文

这是面向 DeepSeek Harness / DSH NEXT 的社区工具包，包含显式选择的 **Ultimate-Model 预设**、可选的**通用工作规则**和严格限定范围的修复工具。参考 [Qoder-Optimization](https://github.com/liushikuan63/Qoder-Optimization) 的按需发现、分段检验、可恢复修改和完整交付方法，按 DSH 实际 SDK 与现有技能适配，不额外安装常驻分类模型或模型网关。

### 下载与选包

当前社区分享包为 **v1.1.0**，内含 **Ultimate-Model 1.5.0**。两个 ZIP 均有独立 SHA256 文件，按固定 Git 提交构建，本机工作文件不进入归档。来源提交和包验收记录见发布附件。

| Download / 下载 | Contents / 内容 |
| --- | --- |
| [完整分享包](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/DSH-Optimization-1.1.0.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/DSH-Optimization-1.1.0.zip.sha256) | 预设、通用工作规则、可选修复工具、测试与双语指南 |
| [独立插件](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/Ultimate-Model-1.5.0.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.1.0/Ultimate-Model-1.5.0.zip.sha256) | 仅 Ultimate-Model 组件；不含根目录修复器和通用规则安装器 |

[本版发布说明](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v1.1.0) · [全部版本](https://github.com/liushikuan63/DSH-Optimization/releases)

GitHub 自动生成的 Source code 是源码快照，需精确验收字节时选择明确命名的资产。根目录用户指南和发布说明采用中英双语；原始技能正文保留来源语言、出处和许可。

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

前置：已有可运行的 DSH Host，以及 **Node.js 22+**。清单使用 `engines.dsh: "*"`，加载时按 Host 接口选择分页适配器。两个接口都不匹配时，此预设会报错。未来宿主升级后先用独立 profile 验证。

1. 下载 ZIP 与对应 `.sha256`，核对哈希，解压到长期保留的目录。
2. 在完整包的 `packages/ultimate-model`（或独立插件根目录）先运行 `node scripts/prepare-install.mjs --check`，再运行 `node scripts/prepare-install.mjs`，生成最终位置的实际资源路径。
3. 让 DSH 先读 `INSTALL-AI.md`，核查现有 bundle 与同 id 覆盖，再用官方 `plugin_manager.install_bundle` 安装组件目录的绝对路径。
4. 核查 `application`、warnings 和 pending builds；需重启时安排维护窗口。绑定工作区，再为该会话显式选择 **Ultimate-Model**。
5. 如需通用规则，在完整包根运行 `node scripts/install-workflow.mjs --home "<DSH_HOME绝对路径>"` 预演，再按审查后的计划加 `--apply`。

实测本地目录安装采用 **link**，安装后须保留源目录。已有规则先备份并保留，定制受管块转人工审查。具体命令见[首次安装](docs/getting-started.md)，不要整体覆盖 Home/profile 或套用 Qoder 安装命令。[使用指南](docs/usage.md)包含复杂任务、提示词、按需技能、并行与不落盘示例。

### 运行修复与实际验收

本版在 Windows x64 上用已安装的 DSH NEXT **2.0.24-next** / Harness **0.2.2-rc.5** 做隔离实测：通过官方管理器链接安装和移除，标准与 Ultimate Model 都可新建会话，并通过本机模拟供应商观察原生分页。首轮保留激活提示并隐藏待分页工具；激活成功后下一轮才显示，同一批次不能提前调用。

本版以 [1.1.0 验收记录](docs/acceptance-1.1.0.md) 为准。1.0.0 引入的[按哈希匹配的可选运行修复](docs/runtime-repairs.md)继续保留，遇到未知字节返回 `REVIEW_UPDATE`。[1.0.0 的历史证据](docs/acceptance.md)仅归属旧版。

### 文档与维护

| Need / 用途 | English | 简体中文 |
| --- | --- | --- |
| Installation / 安装 | [Getting started](docs/en/getting-started.md) | [首次安装](docs/getting-started.md) |
| Skills, task delivery / 能力与交付 | [Usage](docs/en/usage.md) | [使用指南](docs/usage.md) |
| Updates and recovery / 升级与恢复 | [Deployment](docs/en/deployment.md) | [部署](docs/deployment.md) |
| Optional runtime repairs / 可选运行修复 | [Runtime repairs](docs/en/runtime-repairs.md) | [运行修复](docs/runtime-repairs.md) |
| Developer deadline API / 开发者限时接口 | [API](docs/en/diagnostic-deadline-api.md) | [API](docs/diagnostic-deadline-api.md) |
| Evidence and known issues / 验收与已知问题 | [Acceptance](docs/en/acceptance-1.1.0.md) | [验收报告](docs/acceptance-1.1.0.md) |
| Real model trials / 真实模型记录 | [Model validation](docs/en/real-model-validation.md) | [模型验收](docs/real-model-validation.md) |
| Version history / 版本历史 | [Changelog](docs/en/changelog.md) | [更新记录](docs/changelog.md) |

可信源码与现役副本分开保存，升级前核查旧版、本地、新版三方差异并保留定制。构建器只导出白名单公开源码，不导出Home/配置、凭据、经验/检查点、会话、私有日志、应用二进制或诊断探针。反馈时提供脱敏版本、步骤、结果与最小日志。

这是社区适配，不是DSH、Qoder或OpenAI官方发行。公开可见不等于给整个附件重新授权；来源和许可见[第三方说明](THIRD-PARTY-NOTICES.md)及[组件来源](packages/ultimate-model/SOURCES.md)。
