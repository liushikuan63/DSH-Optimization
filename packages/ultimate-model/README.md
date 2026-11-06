# Ultimate-Model (optional preset addon)

按需技能、原生工具分页、证据驱动交付、有边界持续学习与防压缩本地检查点。**只在显式选择 Ultimate-Model（preset id: ultimate-model）时装载**，不覆盖目标机规则、模型、凭据、现有预设或 MCP。

> **换机安装必做一步**：归档内的 `cordis.patch.yml` 保持可移植表达式；导入宿主前必须生成**字面绝对路径**版（否则 bundle 行会被宿主兼容预检禁用）。把包放到新位置后运行
> `node scripts/prepare-install.mjs --check` 再 `node scripts/prepare-install.mjs`。
> 可移植源是 `cordis.patch.template.yml`。

## 安装与选择

前置：兼容的 DSH 0.2.1-rc.2 系列（版本范围见 [package.json](package.json)），Node 22+；可选命令 hooks 测试需要 pwsh 7。Windows/Unix本地路径可解析；UNC部署未验收。

1. 解压后将完整目录交给 DSH 内 AI，先读 [INSTALL-AI.md](INSTALL-AI.md)。
2. 用官方 `plugin_manager` 的 `install_bundle` 安装，target 为**包目录的绝对路径**。不要手写 profile 的 package.json/patch，不使用旧文件覆盖安装器。
3. 以安装结果的 `application`、warnings 为准；新会话显式选择“Ultimate Model”。旧会话不会强行切换。若宿主要求重启，保留待验状态，不擅自重启当前实例。
4. 电脑控制沿用宿主官方能力，本预设不重复创建 native driver/provider，也不覆写 profile 的显式关闭。需要 CUA 时，用官方管理器启用兼容的 registry/适配器 bundle，再核验真实工具投影和实际能力；缺少该可选能力不拖垮核心预设。
5. 需要的 MCP 沿用宿主实际连接；[MCP参考](mcp/fragment.yml)不自动执行、安装或合并。

`node install.mjs --dry-run` 只显示计划、不写文件；旧 `--apply`、覆盖和自动MCP入口拒绝并退出2。卸载先列出已安装bundle，再用官方 `remove_bundle`；不回写旧快照、不删除用户新增文件或经验数据。

## 包内能力

- **轻量契约**：[jizhi-mode](preset/skills/jizhi-mode/SKILL.md)与[规则参考](rules/AGENTS.md)按需读；不再重复常驻长persona。
- **本地技能层**：`skills/local` 由目标机技能层脱敏派生（维护类流程与用户级补充），与 core、preset 同时挂载；仓库源码维护与已安装副本分离，包内项目名与路径已环境化；用户 home 定制独立保留。
- **技能**：core为高频地图，library按需。`jizhi_skill_search`返回实际路径，read后才算读取；查询实时、只读、不信任旧索引。同名项保留来源，不冒充宿主全量目录。
- **工具分页**：目录与激活器同配置；只有成功结果才激活。最多3族，LRU可重载；可选 PTC 通过同一 scope 的分页前元数据完成激活，不绕过其他权限过滤；native不重复列resident完整签名。memory等resident能力不需要伪激活。
- **安全**：预设作用域内注册单调拒绝守卫，win_bash包含在判定范围；SQL逐语句检查，别的WHERE、字符串/子查询不提供放行。它是有限预检，不是完整SQL解析器或数据库权限边界。
- **意图澄清**：[按需流程](skills/core/intent-clarification/SKILL.md)保留原意给出改写、合理选项和建议理由，询问是否符合；事实先查、明确请求不重复确认，推荐/超时/自动答复不等于用户确认或执行授权。它是提示词工作流，不是强制语义分类器。
- **持续学习**：经验模块随选择该模式启用，按工作区隔离、去重、有界保存并按需召回；派发成功事实、明确反馈与待评估候选区分，语义教训仍待审。详见 [持续学习入口](skills/core/experience-loop/SKILL.md)。安全、权限、凭据、模型及MCP访问范围不自动改写；代码型升级仍需验证与适当授权。
- **防压缩**：自动回合快照＋里程碑结构化 save＋恢复指针；restore 对比真实文件 SHA，历史数据不提供授权、取消不复活。已知检查点未恢复前阻止语义覆盖与明确关键写路径。无公开等待式压缩前hook，不承诺零损失；见 [恢复指南](RESTORE.md)。
- **hooks/兼容插件**：源码在包内；默认不注册旧进程桥，不叠加自动续跑链，也不启用超时自动选择。Goal/Plan使用宿主能力。历史代理是 [提示资产](agents)，不是已注册新代理。

## 自检

```text
node scripts/selfcheck.mjs
node scripts/skill-load.mjs --bundle-root . office
```

运行隔离测试前，把 `SKILL_INDEX_TEST_TMPDIR` 指向用户home外已存在的临时目录（例如当前任务专用的临时目录；不要求 D 盘），再运行：

```text
node scripts/selfcheck.mjs --tests
pwsh -NoProfile -File tests/queue-scope.test.ps1
pwsh -NoProfile -File tests/backup-file.test.ps1 -IncludeMigrationApplyFixture
```

自检分层：资源/配置静态检查、隔离正反测试、真实宿主注册与挂载、真实模型工具投影/业务路径。前两层不冒充后两层；没有额外模型调用、桌面前台或生产SQL操作来伪造验收。

## 对话任务自测（按需）

排查、实现与交付复用现有 [verify-before-claim](skills/core/verify-before-claim/SKILL.md) 的[自适应证据闭环](skills/core/verify-before-claim/references/task-selftest.md)：先按风险分流，用最小探针区分假设，再按证据选取声明核对、分层取证、隔离变量、正负对照、最小修复和回归验证，允许跳过、回退或结束，不机械跑满六步。没有缺陷不修复，只读任务不强行修改，简单问答不强行填表；阶段更新只报告结果、证据、缺口和下一格。

```text
node --test tests/task-selftest.test.mjs
node scripts/task-selftest.mjs --input=task-evidence.json
```

第二条仅用于已显式准备的私有账本，格式见[示例模板](skills/core/verify-before-claim/templates/task-evidence.json)。模板缺观测，默认应为未验证；真实任务数据不放入分享包。退出码 0 只表示所给记录一致，1 表示反例／声明冲突，2 为无效输入，3 为未验证。脚本不读会话、不执行动作、不调用模型或网络、不写文件；不能认证引用、真实实载、自然语言质量或用户授权。回归包含隔离评分器变异负对照，不以固定场景全绿冒称模型性能提升。

## 任务组织与模型判断

按需发现和模型 USE/SKIP/ASK/NEEDS_FACTS 判断见 [能力选择](skills/core/skill-router/references/capability-selection.md)。分段验证、长/复杂任务 VibeCoding 文档、提示词优化和有归属的并行执行复用 [vibe-coding](skills/core/vibe-coding/SKILL.md)，不增加重复常驻 hook 或额外模型调用。

## 本轮来源与适配

见 [SOURCES.md](SOURCES.md)。Qoder v0.0.30 与 Codex 本地更新只吸纳按需发现、只读源保护、事务和实体包验收方法；不搬客户端运行配置，不引入新的常驻压缩器。

## 维护与回退

- [CHANGELOG.md](CHANGELOG.md)：本次改动与兼容边界。
- [manifest.json](manifest.json)：机器可读入口；[FILES.sha256](FILES.sha256)：最终文件完整性。
- 查询不写索引；需要快照才显式调用build，`--check`只读。分层移动默认预演，跨卷拒绝以递归删除补救。
- 少量技能仍保留历史项目示例，不能作为目标机事实或通用执行前提；分享前按用途审查，项目命令与配置必须现场核验。
- 本仓库 `skills/` 是版本化维护源；已安装副本用于运行，个人 home 技能与经验保持独立。更新先比较可信旧版、安装版和新版，不用包目录反向覆盖用户 home，也不要求两者逐字节一致。
- 保留第三方工具分页的原始 [NOTICE](preset/lib/NOTICE)。附带 [js-yaml MIT 许可](vendor/LICENSE.js-yaml)。本包不包含目标机凭据、个人经验/检查点库、node_modules或模型配置。

## 按需层与调用协议

- [小内核](preset/skills/jizhi-mode/SKILL.md)只留授权、取消、证据与发现入口；[能力地图](preset/skills/jizhi-mode/references/capability-map.md)和[里程碑模板](preset/skills/jizhi-mode/templates/milestone.json)按需读取。
- 四个 Cordis 官方技能通过 library 薄路由定位。Host Inspect 可用时，检索只查询当前官方包目录并返回真实路径；不读取或拼接官方正文、参考和模板。离线时返回明确的未解析薄路由，不冒充已加载。
- Inspect 与插件管理分别按当前目录的 `cordis_inspect`、`plugin` 族分页；不再次注册 Host Inspect，不把管理工具或官方技能加到其他模式。同 Agent 切走时释放专属提示和监听，切回不重复安装，不清空检查点历史。
- `jizhi_context`、`jizhi_experience` 的公开参数为一个 `request` JSON字符串，例如恢复用 `{"request":"{\"action\":\"restore\"}"}`。内部动作按原严格校验执行，不丢无关字段、不补 null、不禁用或绕过守卫。旧会话若保留旧 Schema，先报告加载缺口；宿主 Goal 的参数接口不由本包改写。
- `node scripts/measure-on-demand.mjs` 实测包内检索耗时和上下文字节/行数；首查不是 OS 冷缓存保证，也不是 provider token/费用测量。真实工具投影另用本轮 SDK/Host 证据验证。

## 运行态与交付边界

静态自检、替身测试、真实 SDK、最终解压产物、正式 profile 加载和真实模型线分别验收。历史测试数量或安装失败记录不证明本轮状态；本机链接指向源目录也不证明已有会话持有新模块。遇到认证拒绝、无法访问或需重启时如实保留缺口，不读取凭据、不换通道绕过、不停本实例。

`cordis.patch.template.yml` 是组合真源；物化器使用包内解析器生成当前目录的 patch 和兼容镜像，路径表达式仅按受支持的数据格式解析，不执行任意 JavaScript。未知、重复或空参数退出2；缺失、包外或类型错误的资源拒绝写入。`FILES.sha256` 必须与 package.files 的实际发布集合完全一致，新增/遗漏文件和本地引用缺失均须失败。个人状态、经验库、检查点、备份和 node_modules 不进入分享包。原 1.3.3 ZIP 不被新版构建覆盖。
