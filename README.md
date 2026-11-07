# DSH-Optimization

**Goal-directed work, on-demand capabilities, and evidence-backed delivery for DSH.** 让 DSH 按目标推进，按需使用能力，把结果和证据一起交付。

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](VERSION)
[![Plugin](https://img.shields.io/badge/Ultimate--Model-1.4.4-blue.svg)](packages/ultimate-model/package.json)
[![Node](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![Verified platform](https://img.shields.io/badge/verified-Windows%20x64-lightgrey.svg)](docs/acceptance.md)

[English](#english) | [简体中文](#简体中文)

## English

DSH-Optimization is a community toolkit for DeepSeek Harness / DSH NEXT. It supplies an explicitly selected **Ultimate-Model preset**, optional **shared workflow rules**, and narrowly scoped repair utilities. Methods from [Qoder-Optimization](https://github.com/liushikuan63/Qoder-Optimization)—on-demand discovery, staged checks, recoverable edits and complete delivery—are adapted to the actual DSH SDK and existing skills. No additional resident classifier or model gateway is installed.

### Downloads and packages

The formal community release is **v1.0.0**, with **Ultimate-Model 1.4.4**. Start with the full share pack. Both archives have separate SHA256 sidecars; published tags and asset bytes are immutable. This is a stable toolkit release with documented host/service limitations, not a promise that all installed plugins or remote accounts are error-free.

| Download / 下载 | Contents / 内容 |
| --- | --- |
| [Full share pack](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/DSH-Optimization-1.0.0.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/DSH-Optimization-1.0.0.zip.sha256) | Preset, shared workflow, optional repair tools, tests and bilingual guides |
| [Plugin only](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/Ultimate-Model-1.4.4.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/Ultimate-Model-1.4.4.zip.sha256) | Ultimate-Model component; no root-level repair/workflow tools |

[Release notes](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v1.0.0) · [All releases](https://github.com/liushikuan63/DSH-Optimization/releases)

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

Requirements: installed DSH core **>=0.2.1-rc.2 <0.2.2-0** and **Node.js 22+**. Actual native acceptance used Windows x64, DSH NEXT 2.0.20-next / core 0.2.1-rc.3. Other platforms and declared core versions have not been individually verified.

1. Download the ZIP and sidecar, verify SHA256, and extract to a directory you will keep.
2. In `packages/ultimate-model` of the full pack (or the standalone plugin root), run `node scripts/prepare-install.mjs --check`, then `node scripts/prepare-install.mjs` to materialize the final location.
3. Have DSH read `INSTALL-AI.md`, check existing bundles and same-ID overrides, and install the absolute component directory using official `plugin_manager.install_bundle`.
4. Check `application`, warnings and pending builds; arrange a maintenance window if adoption requires restart. Bind the workspace, then explicitly select **Ultimate-Model** for that session.
5. Optional shared rules: from the full-pack root, preview `node scripts/install-workflow.mjs --home "<ABSOLUTE_DSH_HOME>"`, then apply the reviewed plan with `--apply`.

The tested directory installation is a **link**: keep the source directory. Existing rules are backed up and retained; customized managed blocks require review. Follow [Getting started](docs/en/getting-started.md) rather than replacing your Home/profile or copying Qoder installation commands. [Usage](docs/en/usage.md) includes complex-task, prompt, skill-selection, parallel-work and no-persistence examples.

### Runtime repairs and acceptance

Version 1.0.0 adds optional exact-byte runtime repairs: footer layout, input-bar ResizeObserver scheduling, bounded HTTP403 classification, Cordis consumer ownership and standing-subagent child-scope cleanup. Genuine duplicate tools, cleanup failures and account denial remain visible. Preview/apply/restore commands, permanent backups and process/identity checks are in [Runtime repairs](docs/en/runtime-repairs.md). Unknown or locally changed files return `REVIEW_UPDATE`; utilities do not stop/start DSH or make model requests.

The optional deadline API is for developers supplying a compliant backend. It is not a resident plugin or an automatic DSH installer. The actual local maintenance used a separate, non-distributed Windows backend: automatic stop at 200001ms, all same-path processes gone at 212639ms, normal archive restored at 226648ms, completed at **226649ms < 300000ms**. Restart and current normal adoption were verified separately. The earlier automatic-restore FAIL and earlier deadline failures remain recorded.

| Evidence | Result and boundary |
| --- | --- |
| Component 1.4.4 | 214 manifest entries; official-manager fresh install/select/deselect/remove passed. Compared with portable review.7: five metadata/document files changed, 210 files identical. Execution code is unchanged. |
| Plugin regression | 311 pass, zero fail/cancel/skip/todo on independently unpacked 1.4.4 predecessor bytes; final R2 changes README line endings and manifest only. Exact artifact association is in acceptance. |
| Integrated tools | 42 focused tests and 37 deadline tests passed, zero fail/skip. Four full-byte input conversions produce the same13a; independent copied-file CLI90→13a→90 passed. Six earlier file-race and two installation-pairing controls remain historical evidence. |
| Native adoption | Deployed normal90 ASAR, component 1.4.4/214 entries and seven specified opaque configuration/data comparisons passed; private probes removed. Normal maximize/restore is read back separately. Added13a is not yet deployed. |
| Real autonomous model work | Earlier third run completed using 11/20 allowed main requests in 103.662s, with RED→GREEN, ledger and independent checks. First two failed runs remain; this release adds zero controlled model requests. |


The deployed runtime is revision90 (`90c23c91…`); the new revision13a subagent cleanup is independently verified on complete owned copies and is **not yet deployed**. The shared18787 proxy, current-user logon task and watchdog are live. A later Bili attribution-log edit belongs to another active task and is preserved. Native Host ACK and account403 remain open; no additional controlled model requests were made.

**Known issues:** official profile access still returns HTTP403/HTML with a CloudFront marker; the exact policy or origin cause is unknown. Host shutdown still showed expected exit, SIGTERM and no ACK. The proven input-bar defect is repaired and bounded normal observation is currently free of RO records; the complete cause of historical periodic RO errors and long-term behavior remain unverified. Native plugin inventory also reports an existing oversized icon in a separate `trae2api-dsh` package; this release preserves that package. These conditions are distinct from Ultimate-Model installation and are not reported as resolved.

See [Acceptance](docs/en/acceptance.md) and the [sanitized machine summary](docs/evidence/acceptance-summary.json) for current windows, historical failures and precise evidence boundaries. A small successful model task cannot guarantee flawless arbitrary business tasks, concurrent edits, cross-platform operation or all third-party plugin combinations.

### Documentation and maintenance

| Need / 用途 | English | 简体中文 |
| --- | --- | --- |
| Installation / 安装 | [Getting started](docs/en/getting-started.md) | [首次安装](docs/getting-started.md) |
| Skills, task delivery / 能力与交付 | [Usage](docs/en/usage.md) | [使用指南](docs/usage.md) |
| Updates and recovery / 升级与恢复 | [Deployment](docs/en/deployment.md) | [部署](docs/deployment.md) |
| Optional runtime repairs / 可选运行修复 | [Runtime repairs](docs/en/runtime-repairs.md) | [运行修复](docs/runtime-repairs.md) |
| Developer deadline API / 开发者限时接口 | [API](docs/en/diagnostic-deadline-api.md) | [API](docs/diagnostic-deadline-api.md) |
| Evidence and known issues / 验收与已知问题 | [Acceptance](docs/en/acceptance.md) | [验收报告](docs/acceptance.md) |
| Real model trials / 真实模型记录 | [Model validation](docs/en/real-model-validation.md) | [模型验收](docs/real-model-validation.md) |
| Version history / 版本历史 | [Changelog](docs/en/changelog.md) | [更新记录](docs/changelog.md) |

Keep trusted source separate from live copies; preserve local customization and review three-way differences before upgrades. The builder exports whitelisted public source, not Home/configuration, credentials, experience/checkpoints, sessions, private journals, binaries or diagnostic probes. Report issues with sanitized versions, steps, observed results and minimal logs.

This is a community adaptation, not an official DSH, Qoder or OpenAI release. Public visibility does not relicense the complete supplied content. See [third-party notices](THIRD-PARTY-NOTICES.md), [component sources](packages/ultimate-model/SOURCES.md) and retained licenses.

---

## 简体中文

这是面向 DeepSeek Harness / DSH NEXT 的社区工具包，包含显式选择的 **Ultimate-Model 预设**、可选的**通用工作规则**和严格限定范围的修复工具。参考 [Qoder-Optimization](https://github.com/liushikuan63/Qoder-Optimization) 的按需发现、分段检验、可恢复修改和完整交付方法，按 DSH 实际 SDK 与现有技能适配，不额外安装常驻分类模型或模型网关。

### 下载与选包

正式社区版为 **v1.0.0**，组件 **Ultimate-Model 1.4.4**。首次使用推荐完整分享包；两个 ZIP 均有独立 SHA256 文件，已发布 tag 和资产字节保持不变。本次正式化的是工具包，宿主与外部服务的已知限制仍如实保留。

| Download / 下载 | Contents / 内容 |
| --- | --- |
| [完整分享包](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/DSH-Optimization-1.0.0.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/DSH-Optimization-1.0.0.zip.sha256) | 预设、通用工作规则、可选修复工具、测试与双语指南 |
| [独立插件](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/Ultimate-Model-1.4.4.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v1.0.0/Ultimate-Model-1.4.4.zip.sha256) | 仅 Ultimate-Model 组件；不含根目录修复器和通用规则安装器 |

[本版发布说明](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v1.0.0) · [全部版本](https://github.com/liushikuan63/DSH-Optimization/releases)

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

前置：已安装 DSH core **>=0.2.1-rc.2 <0.2.2-0**，以及 **Node.js 22+**。真实原生验证环境为 Windows x64、DSH NEXT 2.0.20-next / core 0.2.1-rc.3；声明范围中的其他版本和其他平台未逐一验证。

1. 下载 ZIP 与对应 `.sha256`，核对哈希，解压到长期保留的目录。
2. 在完整包的 `packages/ultimate-model`（或独立插件根目录）先运行 `node scripts/prepare-install.mjs --check`，再运行 `node scripts/prepare-install.mjs`，生成最终位置的实际资源路径。
3. 让 DSH 先读 `INSTALL-AI.md`，核查现有 bundle 与同 id 覆盖，再用官方 `plugin_manager.install_bundle` 安装组件目录的绝对路径。
4. 核查 `application`、warnings 和 pending builds；需重启时安排维护窗口。绑定工作区，再为该会话显式选择 **Ultimate-Model**。
5. 如需通用规则，在完整包根运行 `node scripts/install-workflow.mjs --home "<DSH_HOME绝对路径>"` 预演，再按审查后的计划加 `--apply`。

实测本地目录安装采用 **link**，安装后须保留源目录。已有规则先备份并保留，定制受管块转人工审查。具体命令见[首次安装](docs/getting-started.md)，不要整体覆盖 Home/profile 或套用 Qoder 安装命令。[使用指南](docs/usage.md)包含复杂任务、提示词、按需技能、并行与不落盘示例。

### 运行修复与实际验收

1.0.0增加可选的精确字节运行修复：页脚布局、输入栏ResizeObserver调度、安全HTTP403分类、Cordis消费者所有权与standing subagent子作用域清理。真实重复注册、清理失败和账号拒绝仍会报告。预演、应用、恢复、永久备份与进程/身份检查见[运行修复](docs/runtime-repairs.md)。未知版本或本地修改返回 `REVIEW_UPDATE`；工具不启停 DSH、不发模型请求。

可选自动限时 API 面向提供合规 backend 的开发者，不是常驻插件或自动 DSH 安装器。本机使用另外保留、不公开分发的 Windows backend：200001ms 触发停止，212639ms 确认同路径进程全部退出，226648ms 恢复正常归档，**226649ms 内完成，低于 300000ms 上限**。正常重启及实际采用另行核对，早先自动恢复 FAIL 和截止超时记录保留。

| 验证层 | 结果与边界 |
| --- | --- |
| 1.4.4组件 | 214清单项；官方管理器新解包安装/选择/取消/移除通过。相对便携review.7仅5项元数据/说明变化，210文件相同，执行代码不变。 |
| 插件回归 | 独立解包的1.4.4前一精确实体311 pass、0 fail/cancel/skip/todo；最终R2仅修README换行及清单，关联见验收。 |
| 集成工具 | 42项定向测试与37项限时测试通过，0失败/跳过。四种完整原像转换为同一13a；独立完整副本CLI90→13a→90通过；此前6个文件竞态与2个目录配对反例保留为历史证据。 |
| 本机采用 | 现役正常90归档、1.4.4组件/214清单、7项指定配置和数据opaque比较通过，私有探针已移除；正常窗口最大化/恢复另有读回。 |
| 真实模型自主交付 | 历史第三轮11/20次、103.662秒，实际RED→GREEN、文档与独立复验完整；前两轮失败保留，本版新增受控模型请求0次。 |


现役运行时为90（`90c23c91…`）；新增13a子作用域清理已通过独立完整副本验收，**尚未部署到现役**。18787共享代理、当前用户登录自启和守护已真实运行。随后Bili归因日志属于另一项活跃任务，按用户要求保留。原生Host ACK与账号403仍未解决，本轮新增受控模型请求0次。

**已知问题：** 官方profile仍为HTTP403/HTML/CloudFront标记，具体策略或源站原因未知；Host退出仍有expected=true、SIGTERM、无ACK。确定的输入栏缺陷已修，有限正常观察暂未见RO；历史周期通知的全部来源和长期表现仍未验。原生插件列表另显示既有 `trae2api-dsh` 图标超限元数据错误，本版保留该独立插件。这些问题与Ultimate-Model安装分开报告，不能写成全部已解决。

最新起止窗口、历史失败和实证边界见[验收报告](docs/acceptance.md)及[脱敏机器摘要](docs/evidence/acceptance-summary.json)。小型任务通过不保证任意业务永不出错；跨平台、任意并行写入、全部第三方插件组合仍未验。

### 文档与维护

| Need / 用途 | English | 简体中文 |
| --- | --- | --- |
| Installation / 安装 | [Getting started](docs/en/getting-started.md) | [首次安装](docs/getting-started.md) |
| Skills, task delivery / 能力与交付 | [Usage](docs/en/usage.md) | [使用指南](docs/usage.md) |
| Updates and recovery / 升级与恢复 | [Deployment](docs/en/deployment.md) | [部署](docs/deployment.md) |
| Optional runtime repairs / 可选运行修复 | [Runtime repairs](docs/en/runtime-repairs.md) | [运行修复](docs/runtime-repairs.md) |
| Developer deadline API / 开发者限时接口 | [API](docs/en/diagnostic-deadline-api.md) | [API](docs/diagnostic-deadline-api.md) |
| Evidence and known issues / 验收与已知问题 | [Acceptance](docs/en/acceptance.md) | [验收报告](docs/acceptance.md) |
| Real model trials / 真实模型记录 | [Model validation](docs/en/real-model-validation.md) | [模型验收](docs/real-model-validation.md) |
| Version history / 版本历史 | [Changelog](docs/en/changelog.md) | [更新记录](docs/changelog.md) |

可信源码与现役副本分开保存，升级前核查旧版、本地、新版三方差异并保留定制。构建器只导出白名单公开源码，不导出Home/配置、凭据、经验/检查点、会话、私有日志、应用二进制或诊断探针。反馈时提供脱敏版本、步骤、结果与最小日志。

这是社区适配，不是DSH、Qoder或OpenAI官方发行。公开可见不等于给整个附件重新授权；来源和许可见[第三方说明](THIRD-PARTY-NOTICES.md)及[组件来源](packages/ultimate-model/SOURCES.md)。
