# DSH-Optimization

面向 DeepSeek Harness / DSH NEXT 的 Ultimate-Model 可移植优化包。参考 Qoder-Optimization 的按需能力、源数据保护和证据驱动交付方法，针对 DSH 的实际 SDK、预设与插件组合适配。

当前仓库发行版 0.1.0，插件版 1.4.3-review.6。默认提供一个显式选择的 `ultimate-model` 预设；公开工具名称 `jizhi_*` 保持兼容。源码、测试和文档一起分发，不含模型账号、私有规则、个人经验/检查点库或 DSH 安装程序。

本轮归档、311项插件回归、独立官方安装/SDK/UI与本机部署已验证；真实Provider任务仍为0请求、PREREQ未验，详见验收报告。首发按预发布交付，不把离线fixture当作真实模型效果证明。

目标是让 DSH 读清需求、按目标推进、验证结果后交付。规则负责指导模型，原生守卫负责拦截已覆盖的风险；它们不能保证任意模型永不犯错，实际效果与验证范围见[验收报告](docs/acceptance.md)。

## 安装

前置：已安装兼容 DSH（core >=0.2.1-rc.2 <0.3.0）、Node.js 22+。本轮真实环境是 Windows x64；其他平台与 UNC 路径仍需各自验收。可选 PowerShell 测试需要 pwsh 7。

1. 从可信发行来源独立校验下载 ZIP 的 SHA256，解压到稳定目录。保留原包；不要覆盖现有个人目录。
2. 在 `packages/ultimate-model` 运行 `node scripts/prepare-install.mjs --check`，再运行 `node scripts/prepare-install.mjs`。第一条只读核验清单与模板资源；第二条在这个包副本物化字面路径并自检，不改 profile。
3. 在 DSH 中使用官方 `plugin_manager.install_bundle`，target 为该完整目录的绝对路径。先列出已有 bundle，检查 Home/profile 是否还有旧同 id 注册；[部署说明](docs/deployment.md)说明增量更新与回退。
4. 按 installation.application、warnings、pendingBuilds 核对是否已加载。需要重启时先确认活跃任务可中断，不能把文件已写当作本代进程已采用。新任务显式选择 Ultimate-Model，再实际调用所需能力。

不要把 `pnpm --no-optional` 当作统一修复；它可能使原生能力缺项。包内 install.mjs/uninstall.mjs 旧 apply 入口仍拒绝文件覆盖，不是官方管理器替代品。

### 所有模式的工作规则

完整分享包另含可选的全局工作规则：长/复杂任务先沿用或建立 VibeCoding 文档，写清目标、完成条件和下一步；按阶段验证并继续已授权工作；修改前检查归属，涉及删除先确认必要性和恢复方式；并行任务明确文件归属。

在完整分享包根目录运行 `node scripts/install-workflow.mjs --home <DSH_HOME绝对路径>`，先查看只读计划。确认计划后加 `--apply` 安装。脚本只向 `AGENTS.md` 追加受管区块，先保存完整备份并核对原始字节，不改变默认模式。已存在但被定制的受管区块返回 `REVIEW_UPDATE`，交由人工合并，不自动覆盖。单独插件 ZIP 不含此可选入口；详见[全局规则说明](overlays/README.md)。

## 本轮修复和补充

- 按需索引涵盖 core、library、local 三层。索引和关键词用于找候选，当前模型根据任务与工具事实做 `USE / SKIP / ASK / NEEDS_FACTS` 判断，再按需读技能正文；不增加额外模型分类请求，不用候选跳过取消必需验收。
- Ultimate-Model 的常驻提醒包含目标、完成条件、分段验证和持续推进；复杂任务沿用 VibeCoding 台账，提示词优化与并行协作复用已有技能，避免再建一套冲突流程。
- 明确“不落盘/不写盘”禁止自动经验与检查点持久化；真人、引用、工具消息和继承历史分开处理。
- 分发保留可移植 patch；安装便利入口先使用 Node 内置模块读取数据校验全部文件，再执行其他包内脚本。入口本身仍须先建立外部来源信任。
- bundle 元数据发现包含 local 层；JSON 索引、可读目录和技能层级状态按同一次输入生成，有预像比较、暂存、失败恢复及并发写入保护。
- 补齐实际编辑工具的凭据读写与大文件读取检查、常见递归删除形式的拦截；保留有界前台许可的真实执行身份和单次消耗，不由工具参数制造授权。
- 去掉依赖缺失时会破坏整个预设、存在时又可能绕过用户停用设置的私有 native driver，沿用宿主 provider 与开关。
- 更新部署、EPERM、组合覆盖和独立实装判据。浮层通过各插件正常确认/关闭，不禁用模态语义或强制穿透点击；预览说明与 Vision Router 首次引导分别处理。

## 验证与构建

将 `SKILL_INDEX_TEST_TMPDIR` 指向用户 home 外已存在的任务临时目录，然后在 `packages/ultimate-model` 运行 `node scripts/selfcheck.mjs --tests`。其他回归和层级边界见[验收报告](docs/acceptance.md)。

运行 `python scripts/build-release.py --output-dir <仓库之外的目录>` 生成独立插件 ZIP、完整分享 ZIP 与 SHA256 侧车。构建器仅归档白名单，不执行外部网络或安装依赖；同名输出存在时拒绝覆盖。

本仓库公开可查看并保留来源声明；原始附件没有覆盖全部内容的统一许可证，Public 不等于对整个源码重新许可。详见 [来源与许可边界](packages/ultimate-model/SOURCES.md)和[第三方声明](THIRD-PARTY-NOTICES.md)。
