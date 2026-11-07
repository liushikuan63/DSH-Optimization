# DSH-Optimization

让 DSH 更有目标地推进任务：按需选择能力，保留已有改动，分段验证，把结果和证据一起交付。

[![Version](https://img.shields.io/badge/version-0.1.2-blue.svg)](VERSION)
[![Plugin](https://img.shields.io/badge/Ultimate--Model-1.4.3--review.6-blue.svg)](packages/ultimate-model/package.json)
[![Node](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![Verified platform](https://img.shields.io/badge/verified-Windows%20x64-lightgrey.svg)](docs/acceptance.md)

[下载与选包](#下载与选包) · [首次安装](docs/getting-started.md) · [使用示例](docs/usage.md) · [验收报告](docs/acceptance.md) · [更新记录](docs/changelog.md)

这是面向 DeepSeek Harness / DSH NEXT 的社区优化包，包含显式选择的 **Ultimate-Model 预设**，以及可选的**通用工作规则**。参考 [Qoder-Optimization](https://github.com/liushikuan63/Qoder-Optimization) 的按需能力、可恢复修改和证据驱动交付方法，按 DSH 的实际 SDK、预设、插件管理器与现有技能适配。

## 下载与选包

首次使用推荐下载**完整分享包**，无需克隆仓库。当前版本为 **v0.1.2 预发布**；插件仍为已验收的 **1.4.3-review.6**。完整包带版本化顶层目录，两个 ZIP 都有独立 SHA256 文件。

| 下载 | 包含内容 | 适合谁 |
| --- | --- | --- |
| [完整分享包 ZIP](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.2/DSH-Optimization-0.1.2.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.2/DSH-Optimization-0.1.2.zip.sha256) | 插件、通用工作规则安装器、上手/使用/部署文档、测试与验收摘要 | 首次安装、分享给他人，或希望各模式采用通用工作规则 |
| [独立插件 ZIP](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.2/Ultimate-Model-1.4.3-review.6.zip) · [SHA256](https://github.com/liushikuan63/DSH-Optimization/releases/download/v0.1.2/Ultimate-Model-1.4.3-review.6.zip.sha256) | 仅 Ultimate-Model 及其自带技能、脚本、清单和说明 | 已有独立工作规则，只需安装或更新该预设 |

[本版发布说明](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v0.1.2) · [全部版本](https://github.com/liushikuan63/DSH-Optimization/releases) · [历史记录](docs/changelog.md)

GitHub 自动生成的 Source code 是源码快照；需要本轮固定字节、测试关联和配套校验文件时，选择上表明确命名的资产。已发布 ZIP 和 tag 保持不变，后续修复发新版本。

## 能改善什么

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

## 首次上手

前置是已安装兼容 DSH：core **>=0.2.1-rc.2 <0.3.0**、Node.js **22+**。本轮真实验证环境为 Windows x64、DSH NEXT 2.0.20-next / core 0.2.1-rc.3；声明范围中的其他版本和其他平台未逐一验证。

1. 下载 ZIP 与对应 `.sha256`，核对可信发行来源和文件哈希，解压到长期保留的目录。
2. 在最终插件目录先运行 `node scripts/prepare-install.mjs --check`，再运行 `node scripts/prepare-install.mjs`，生成当前位置的实际资源路径。
3. 让 DSH 先读包内 `INSTALL-AI.md`，检查现有 bundle 与同 id 注册，再用官方 `plugin_manager.install_bundle` 安装这个插件目录的绝对路径。
4. 按管理器的 `application`、warnings、pendingBuilds 判断是否采用；需要重启时安排维护窗口。新任务先绑定目标工作区，再显式选择 **Ultimate-Model**。
5. 如需各模式的通用工作规则，在完整包根运行 `node scripts/install-workflow.mjs --home "<DSH_HOME绝对路径>"` 查看计划，再按计划加 `--apply`。个人原文先备份并保留；不同或定制受管块返回 `REVIEW_UPDATE`，不直接覆盖。

**本轮官方本地目录安装采用 link，安装后请保留原目录。** 不要安装后删除解压目录，也不要套用 Qoder 的安装命令、覆盖整个 Home 或手写 profile。具体命令、安装给 AI 的任务描述和完成检查见[首次安装指南](docs/getting-started.md)。

安装后可在自己新建的小型工作区先验证一次：让 DSH 写明目标、创建一个小函数和测试、实际运行测试、记录退出码并核对保护文件。示例和长任务用法见[使用指南](docs/usage.md)；真实模型会消耗你的现有额度。

## 本版实际验证了什么

**第三轮受控自主续任务完整通过。** 在新增20次主请求/300秒预算内，模型使用11次、103.662秒，从前轮已有的两份DSH代码继续，实际完成13项测试、故障注入→恢复、VIBECODING文档和最终交付；运行中没有协调者追加提示或代写产物。独立复测13/13，另5个正例+18个非法输入用例通过，原3个保护文件的字节、哈希和mtime均未变。

| 验证层 | 结果 | 证据范围 |
| --- | --- | --- |
| 冻结插件回归 | 311 pass，0 fail/cancel/skip/todo | 最终review.6插件ZIP独立解包后执行 |
| 全局工作规则 / 本机原守卫 | 16 / 27 项通过 | 隔离规则安装测试 / 本机守卫回归 |
| 原装 SDK、Host/UI、官方管理器 | 通过 | 模态、模式选择、真实工具、停止、禁存、刷新；模型为离线fixture |
| 本机实际部署 | 通过 | 精确版本/清单、备份、规则采用、正常重启及健康事件读回 |
| 真实模型自主续任务 | 本轮11/20，正常completed | 模型实际RED→GREEN，文档齐备，独立复验；前两轮失败保留 |

0.1.2完善面向使用者的文档与脱敏验收记录；插件、脚本、测试和通用规则保持已验字节，未为文档更新重跑未变代码的全套测试。前两轮各6次失败仍保留，三轮累计23次SDK主请求；内部HTTP重试次数和实际账单未统计。临时验收插件和上限已清理，正常DSH没有6次或20次限制。

默认Node测试子进程在DSH只读沙箱内仍可报 `spawn EPERM`，本次同一单测试文件采用同进程路径完整通过；不能推广到所有测试套件。仍有一条此前已出现的账号读取日志，启动健康不代表所有账号无错误。跨平台、真实业务长任务、任意并行写入和所有第三方插件组合仍未验。

完整命令、首红、修复、独立验收及限制见[验收报告](docs/acceptance.md)、[真实模型记录](docs/real-model-validation.md)和[机器可读摘要](docs/evidence/acceptance-summary.json)。一次小型续任务通过不构成任意模型永不犯错的保证。

## 文档导航

| 需要 | 入口 |
| --- | --- |
| 下载后安装、校验、首次检查 | [首次安装](docs/getting-started.md) |
| 长任务、按需技能、提示词、并行和不落盘示例 | [使用指南](docs/usage.md) |
| 已有配置升级、EPERM、模态、卸载和回退 | [部署与恢复](docs/deployment.md) |
| 包内能力入口和检索协议 | [插件README](packages/ultimate-model/README.md) |
| 全局工作规则安装器及退出码 | [通用工作规则](overlays/README.md) |
| 版本变化与维护者构建发布流程 | [更新记录](docs/changelog.md) |
| 独立实装与真实模型证据 | [验收报告](docs/acceptance.md) |
| 第三方来源和许可范围 | [第三方声明](THIRD-PARTY-NOTICES.md) · [插件来源](packages/ultimate-model/SOURCES.md) |

## 维护、反馈与许可

源码用于维护，已安装副本用于运行；升级先比较可信旧版、当前安装与新版，保留本地定制。构建器仅收集公开白名单，不读取用户Home，不打包账号、私有规则、经验/检查点库、node_modules或临时验收辅助。维护者按[固定源码→独立实装/字节核对→发布后下载复核](docs/changelog.md#维护者发布流程)交付。

欢迎提交问题和改进。请附DSH/core/Node版本、具体步骤、预期与实际结果、脱敏日志及是否发生在隔离工作区；涉及拦截逻辑时同时给出应拒绝和应允许的例子。请勿上传账号、token、完整个人配置或私有会话。

本项目是社区适配，不代表DSH、Qoder或OpenAI官方。原始附件没有覆盖全部内容的统一许可证，Public不等于将全部源码重新许可；js-yaml、工具分页组件及借鉴方法各自保留来源与许可。详见[第三方声明](THIRD-PARTY-NOTICES.md)。
