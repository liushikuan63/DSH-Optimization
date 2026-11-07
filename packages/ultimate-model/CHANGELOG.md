# 1.4.3-review.7（兼容边界元数据修订，2026-11-07）

- 仅将 core 兼容声明收窄为 `>=0.2.1-rc.2 <0.2.2-0`，同步 package/manifest/说明/哈希清单；业务代码与 review.6 逐字节相同。
- 0.2.2 预发布版及后续版本未适配、未验收；本版不升级 DSH，不创建版本豁免；支持版本的实际安装另行验收，不继承新 SDK 的实装或模型通过结论。
- Metadata-only compatibility revision: excludes every 0.2.2 prerelease and later release. Runtime code, scripts and existing tests are byte-identical to review.6. No new-SDK or live deployment acceptance is claimed.

# 1.4.3-review.6（2026-11-07）

- 依据用户实际使用反馈，把目标/完成判据、分段检验、复杂任务文档、持续推进和写入归属提醒放入所选模式的短 persona，避免只在可选技能正文中出现。任务取消仍停止，不增加无人值守自动续跑链。
- 修复真实 SDK str_replace_editor 使用 path/command 绕过凭据写入/读取和大文件分段检查；有界200行view保持可用。
- 补齐 rm -r/--recursive、Remove-Item/ri 的明确递归删除写法；普通非递归操作和只读命令范例保持可用。这是有限预检，不宣称覆盖任意脚本或语义误改。
- 还原 portable 的有界真人前台授权代码与真实 execution 绑定，避免预设再次否决全局合法许可；不分发个人 grant 文件，不把前台许可放宽到 shell 输入原语。
- 本机全局守卫只按已核对旧版做定点更新，保留原授权逻辑；最终运行和真实模型验收另列，不继承 review.5 的包身份。

# 1.4.3-review.5（2026-11-07）

- 兼容 Windows 的 CRLF 便携镜像：以解析后的同一配置结构比较，仍固定输入字节与身份并在发布前 CAS，不因等价换行拒绝完整包。
- 补齐按需候选的模型 USE/SKIP/ASK/NEEDS_FACTS 判断、分段检验、提示词优化、长/复杂任务 VibeCoding 文档和有归属的并行执行。复用已有入口与宿主能力，不加常驻分类器或额外模型请求。

# 1.4.3-review.4（2026-11-07）

- 最终 ZIP 的独立实装发现：基础包＋Web UI profile 没有 computerUse registry，无条件启用 native CUA 子插件会使整个预设 broken。同时发现本机 profile 明确关闭 native，服务存在也不能提供启用授权。移除预设内重复 native provider，统一沿宿主官方能力与开关；不修改宿主 bundle、权限或账号。
- review.3 首红 ZIP 与日志保留，未部署失败版；本版需按新 SHA256 独立实装，不继承上版安装结论。

# 1.4.3-review.3（2026-11-07）

- 修复明确“不落盘/不写盘”指令未抑制自动经验与检查点写入；两个观察器共用禁存判断。
- 分发保留可移植 patch，prepare-install 先校验原始清单再物化当前副本；修正旧预设名、容量说明及泛化安装建议。
- 从 Qoder v0.0.30 与 Codex 本地验收方法适配按需发现、同快照元数据与并发回退保护；来源、许可和验证范围见随包说明。
- 真实部署与独立 ZIP/SDK/UI 验收以本轮报告为准，历史测试数量不继承为本轮通过。

# 1.4.3-review.2（第二轮本地审查，2026-11-05）

## 2026-11-06 补丁：补全两行 bundle 插件声明并纳入实测经验

- 修复包自带自检恒红：`cordis.patch.yml` 与 `cordis.patch.template.yml` 的 `insert` 缺
  `ultimate-model-experience-loop`、`ultimate-model-context-checkpoint` 两行，
  而 `scripts/validate-bundle.mjs` 要求生效行恰好四行（含 `preset-ultimate-model`）。
  现两份文件各补两行，`name` 使用 `scripts/package-resource.mjs` 唯一接受的
  可移植解析器表达式，解析结果落在包内。
- **两份 patch 的 name 形态不同，不可互抄**：`cordis.patch.template.yml` 保存可移植
  `__jsExpr`（真源）；`cordis.patch.yml` 是**物化后的归档**，必须是字面绝对路径。
  按 `INSTALL-AI.md`，表达式型 `name` 会被宿主兼容预检判为无法校验并 `disabled`，
  日志只留一行 `disabling profile plugin row ...`。本次两行先写入 template，
  再由包自带 `materialize.mjs` 生成 patch（`rewritten: 8, validated: 8`），未手写 patch 侧。
- `cordis.patch.template.yml` 必须保持 JSON 文本形态（`tests/materialize-boundaries.test.mjs`
  以 `JSON.parse` 读取），补行时不得改用 YAML 序列化。
- `rules/rules-reference.md` 新增两章：`profile 插件安装失败根因与正确流程`、
  `billion-context 使用要点`；`rules/AGENTS.md` 第五节补两条对应路由。
  内容来自本机实测（Windows / DSH NEXT 0.2.1-rc.3 / pnpm 12.9.1 / hoisted），
  已在文中标注适用边界，未写成跨平台通用结论。
- `rules/rules-reference.md` 另增 `推荐插件与来源` 一章：15 个插件的 npm 包名、
  上游仓库、2026-11-06 实测版本与各自安装前置条件（凭据依赖、与 `replacePwsh` 的冲突、
  同域互斥、native 依赖）。来源取自各包 `package.json` 的 `repository` 字段，
  非人工拼写；表内版本为快照，文中已要求目标机按自身宿主版本核对 `engines.dsh`，
  并声明不构成对上游安全性/许可/维护的背书。外部链接按 `audit-references.mjs`
  规则不计入包内路径校验。
- 历史安装经验曾泛化为必然 EPERM、统一 --no-optional 和唯一 Tool.listTools 判据；review.3 已纠正为按文件、阶段、版本和能力实测，不把旧记录视为通用安装授权。
- 验收：`scripts/selfcheck.mjs --tests` 265 项全通过（0 失败）；
  `build-manifest.mjs --check` 无漂移；`validateManifestCoverage` 覆盖一致；201 个文件哈希全匹配。

- 根归档校验仅读取数据与哈希，不导入 Addon 代码；固定组件目录并校验两层清单、分发覆盖和资源类型。
- 物化器严格拒绝未知/重复/空参数；已有字面路径和可移植路径统一验证存在性、类型及包内归属；仅解析已分发的路径表达式格式，不执行任意 JavaScript。
- 修复可选 PTC 分页后无法激活 namespace：按 exact agent/scope 共享本分页层隐藏前的元数据，保留其他权限限制，释放时清除自有掩码及记录；发行默认仍为 native。
- 备份用独立 GUID 且不覆盖旧文件；完整后缀识别源归属；删除失败退出1且不计成功；迁移快照排除输出根并拒绝覆盖同名目标。
- 增加物化/静态校验/PTC/备份回归，补正 React/Vue 适用范围和未分发截图脚本说明。Base 运行包未修改。
- 仅对输入 final.zip 的独立副本维护，原始包与真实 profile 不变；隔离结果不代表真实 DSH 宿主、PTC 服务或跨平台验收。

# 1.4.3-review.1（本地审查衍生版，2026-11-05）

- 修复发行预设 ID 与两个核心插件作用域不一致；保留 jizhi_* 工具和数据目录兼容。
- 取消信号优先于可选自动回答中的迟到超时；默认仍不启用自动选择。
- 物化默认写实际加载的 cordis.patch.yml；自检包含嵌套 local-memory 测试。
- 测试从本包导入，文件夹具使用指定临时目录或系统临时目录；移除 Python 缓存。
- 修正静态引用、未分发执行器说明、Wiki脚本调用和 SVN 通用流程。集合级布局、脱敏与清单见根目录 README-share.md。
- 此版本是对用户提供归档的本地衍生，未发布到上游、未修改真实 profile；真实宿主和模型投影仍待验证。

# 1.4.3 · 跨会话恢复污染与容量墙修复

## 空笔记不再锁死写路径

- 修复恢复门在**语义笔记为空**时仍然锁死 `write`/`edit`/`win_bash` 的问题。门禁的目的本是阻止压缩后的空白笔记覆盖有价值内容；当笔记本身就是空的时候没有可保护的对象，但旧谓词照样在每次上下文替换后上锁，要求的 restore 又不可能改变那份空笔记，于是写路径被永久拒绝。
- 现场形态：`restore` 返回 `"objective": ""`、所有数组为空、`semanticNoteMissing: true`、`found: true`，紧接着的 `git status` 被 `JIZHI_CONTEXT_RESTORE_REQUIRED` 拒绝。
- 现在门禁只在笔记确有内容（`objective` 非空）时生效；空笔记会话不上锁，可直接重新 `save`。有内容的笔记仍然照常上锁，压缩保护没有削弱。
- 新增 `tests/context-empty-note-gate.test.mjs`：空笔记不上锁（含跨轮次复测）+ 有内容笔记仍上锁的正对照。负对照换回旧文件后 `EMPTY_NOTE_MUST_NOT_GATE` 转红。

## 关于 `replaceGeneration` 的已知边界（未改动）

- 该计数器会在普通推进中上涨：同会话两个快照实测 `10 → 13`，间隔 427 秒，期间日志无 `compaction` 记录。因此「一次 restore 的解锁能维持多久」取决于计数器何时再变，这一点本轮**未修改**，也未宣称修复。
- 相关：`mustRestore()` 与系统提示回调都用 `generation !== state.generation` 判断重新武装。曾尝试改为单调比较（`>`），但在「surface 重建、计数器回落」场景下与旧判据等价，且负对照不转红，故已撤回，未留在代码中。

## 容量墙不再由过期记录持有

- 修复 `CAPACITY` 无法自行解除的问题。原先容量判定（`store.mjs` 的 `locked()`）统计的是**目录个数**，而 `inspect`/`restore` 会隐藏过期记录：工作区写满 16 个会话目录后，即使每一条都已超过 7 天 TTL、`inspect` 返回空列表，`save` 仍永久返回 `JIZHI_CONTEXT_CAPACITY`，重启也不恢复。这正是「重启无效」的实际成因。
- 现在容量按**仍有可读且未过期记录**的目录计数：任一代（当前版或上一版）未过期即占名额；两版都不存在或都过期则释放名额。
- 损坏、畸形或不可读的记录**仍然占名额**，并计入读失败：容量不能靠损坏文件释放，坏记录仍属于某个会话。
- 过期目录与文件**不被删除**，只是不再 reserving 名额；清理仍需显式授权。
- 新增 `tests/context-capacity-live.test.mjs`：填满→拒绝、过期后放行、过期文件仍在、新记录占位后重新拒绝，外加「篡改记录仍占名额」的反例。先红后绿。
- `maxSessions` 仍是硬编码的 `LIMITS.maxSessions`（16），本轮未改为可配置。

## 跨会话恢复不再污染本会话

- 修复 `jizhi_context` 跨会话 restore 会重写本会话标记的问题：`{"action":"restore","checkpoint":"<别的会话 ID>"}` 现只读取对方笔记，不再覆盖本会话的 `checkpoint`、`status` 与 `disabled`。缺陷形态：本会话指针被改成对方 ID（于是本会话随后的裸 restore 报 `found:false`）、对方 `cancelled`/`blocked` 状态串进恢复索引提示、对方 `disabled=true` 会连带停掉本会话记忆流程；对从未保存过的会话，一次跨会话读取即可让该会话在下次上下文替换后被恢复门锁住。
- 该隔离在 1.3.1 已有（`input.action !== 'restore' || result.scope === 'session'`），1.4.x 重写为无条件 `update(result)` 时丢失，本次按原判据恢复并同时覆盖 `disabled`。
- 新增 `tests/context-scope-isolation.test.mjs`：先红后绿，含「从未保存的会话不因外部 ID 获得标记、也不会被锁」的反例。

## 验证与边界

- 验证：`node --check` 通过；全量 `tests/*.test.mjs` 189 项全绿（需预先设置 `SKILL_INDEX_TEST_TMPDIR`，指向用户 home 外目录）；两处修复均做了「换回旧文件 → 用例转红 → 换回修复版 → 转绿」的负对照。
- 未在本轮修复、仍存在的可用性缺口：检查点过期（7 天 TTL）后若恢复门已武装，`restore` 返回 `found:false` 且 `save` 被同一谓词拒绝，需等下一轮 `agent/turn-stopping` 快照刷新后才恢复；当前版损坏时裸 `restore` 抛 `JIZHI_CONTEXT_CORRUPT`，不带「改用 previous 版」指引。两者均可自愈或经 `inspect` + 显式 previous ID 绕过，非数据损坏。
- 本条目只描述源码与隔离验证，不代表已装实例已重新装载；实载验收需独立进行。

# 1.4.2 · 显示名更正

- 显示名由 `Ultimate Modle` 更正为 `Ultimate Model`，覆盖预设显示名、`preset/preset.yml`、`locale/zh.json`、README、CHANGELOG 与相关技能正文；`cordis.patch.yml` 与 `preset/agent.cordis.yml.tpl` 由 materialize 重新生成，保持三处一致。
- 技术标识仍不变：包名 `@local/dsh-jizhi`、预设 id `jizhi`、技能 `jizhi-mode`、工具 `jizhi_*`。改名不影响已装实例的调用契约，只换用户可见文案。
# 1.4.1 · 单源化、运行时实例交接与本地技能层

- 从目标机 home 回灌 `DSH_*` 环境变量继承导致"新实例读到另一侧 home"的实测条目（2026-10-25）：现象、正确做法、无效反例与三条判据，措辞做环境化，不含本机绝对路径与脚本名。
- 明确技能正文的单一编辑源是目标机 home 技能层，本包 `skills/` 为派生并环境化的只读分发镜像；包内不再直接改正文，改动走 home → 环境化 → 版本/清单 → 发版。
- 同批把包侧较新的授权口径与回退入口语义回灌到目标机 home 技能层（context-checkpoint / experience-loop / skill-router / verify-before-claim / long-task-discipline / vibe-coding / backup-retention），home 侧保留本机实测路径与项目指向。
- 新增随包技能层 `skills/local`（8 项）并加入 skill-filesystem 挂载：4 个维护类流程（门禁机制化、规则冲突审计、引用完整性审计、入站包合并）与 4 个用户级补充（CI 取证、记忆插件说明、技能质量、多仓工作流）。与 `skills/core`、`skills/library` 无同名冲突。
- 该层由目标机技能层脱敏派生：真实用户路径改 `%USERPROFILE%`、本机盘符改占位符、组织与项目标识改 `demo`/`org`、内网表述改「内部网络」；旧版归档与本机工作区清单不进包。
- 模板与镜像同步：`cordis.patch.template.yml` 增加第三个 `customSkillDirs` 条目，`cordis.patch.yml` 与 `preset/agent.cordis.yml.tpl` 由 materialize 重新生成，三者保持一致。
- 兼容性：新增层只挂载不替换，原有 core/library/preset 行为不变；目标机若已有同名技能，宿主按发现根顺序去重，不会覆盖本机内容。
# 1.4.0 · 小内核与按需能力层

## 对话任务自测增强

- 将六项建议完善为自适应证据闭环：风险分流、竞争假设和低成本探针驱动，六项为可跳过或回退的检查点而非固定流水线；没有缺陷不修复。由现有 verify-before-claim、runtime-truth-verifier 与Ultimate Model入口共用单一按需参考，不新增同域技能或常驻长提示。
- 增加只读证据账本检查：按当前作用域、修订、精确层级及预期结果判定一致性；跳过和缺证据保留未验证，无证据的完成声明拒绝。输入限额、严格字段、短引用及链接检查保持失败关闭；不回显输入数据。
- 增加对话契约、CLI 退出码和隔离变异负对照；模板故意不含观测，不会默认通过。固定场景仅证明检查器与文本接线，不认证自然语言行为、引用真实性、真实模型或 Host 加载。
- 参考公开 Agent 评测方法独立适配；不接入外部评测平台、不新增模型调用、自动重试或执行权限，不修改 profile、安装状态或版本号。
- 分享前收敛增强范围，不继续叠加未经效果验证的自动化。运行期核验改为目标机现场发现，移除作者机器 MCP／CLI 状态断言；补静态负对照，并明确 ZIP 完整性、来源认证、物化后验证与正式加载的不同边界。

## 正式加载验收后修补

- 修复经验记录公开契约：省略可选 evidenceCallIds 时使用空证据列表，候选仍为 pending/unproven；显式非法值和无关键继续拒绝。补存储层与 request 信封的先红后绿回归。
- 修复 native 精简目录误报：省略常驻签名不再宣称“没有工具”或替代完整工具清单。组装与消息发布传递同一省略状态，覆盖未激活、失败激活、成功激活及 LRU；真正空工具面、完整目录和 PTC 语义保持不变。
- 容量满属于既定保护：保留每工作区最多 16 个会话目录及不自动删除历史的边界；补满额时拒绝新会话而不损坏旧记录、旧会话仍可更新的回归。TTL 不自动释放目录，处理容量需要另行授权。
- 本补丁仅维护源代码与隔离验证，不代表现有会话或正式 Host 已加载新代码；真实工具投影仍需独立验收。

## 原 1.4.0 内容

- 正文、参考与模板分层；检索只解析有界 frontmatter 前缀，保持错误/无命中区分，覆盖 CRLF 和分块边界负例。
- library 增加四项 Cordis 官方能力薄路由。通过现有 Host Inspect 的 Config packageDir 定位官方源，不复制正文、不硬编码作者路径。
- 仅 jizhi 加入官方 Inspect/插件管理 consumer，并纳入同源分页；不重复注册 Host Inspect，不修改其他模式。
- 修复同 Agent 切走后上下文提示残留：即时按当前模式判定、切走释放提示/监听、切回仅安装一次，保留检查点/取消/禁用状态。补切模单测与真实 SDK 正反例。
- jizhi_context / jizhi_experience 的模型公开参数改为一个 request JSON字符串，避免投影要求补齐其他动作字段。内部仍运行原严格动作校验与守卫；不接收 null占位或忽略无关键。根联合方案因 strict/native 兼容性反证排除；宿主 Goal 的可选参数问题不由本包修复。
- 物化器改用包内解析器，兼容镜像由唯一模板生成；完整校验发布文件与哈希清单等值，并检查所有本地 Markdown 引用。原1.3.3 ZIP保留。
- 可复现的检索耗时/上下文字节测量入口随包提供；SDK、正式Host、模型线与最终ZIP证据分开报告，不把静态或历史通过冒充本轮实载。

# 1.3.1 · 2026-10-25

- 真实注册表/SQLite查询服务发现：Agent自身未inject sessionQuery，不能通过agent.ctx直接读取；经验/上下文查询改用声明过依赖的插件ctx，保持会话与工作区校验。替身加入同样的访问约束。
- 修正Shell GUI拒绝提示，不再把已禁止的前台键盘注入描述成已放行；拒绝不提供改通道或前台重试授权。
- 1.3.0仅作为历史隔离内核证据保留，不证明经验/上下文业务链已经有效。当前Host正式装载仍独立验收。

# 1.3.0 · 2026-10-25

- 真实SDK检出并修正effect生命周期：四个入口改为返回disposer，避免加载即注销。四个单测替身同步穷尽生成器，对齐Cordis 4.0.5；保留旧版本红证据。旧1.2.0不应作为工具/守卫已有效的证明。

- 新增 intent-clarification 按需技能：保留原意、草案/选项/建议理由、询问确认、事实先查与明确请求不重复确认。
- 规则摘要保留短入口；澄清不提供执行授权，推荐/自动答案/超时不构成确认。不增加额外模型、网络或MCP调用。
- 补入口/文本契约及两类破坏性文本变异负对照；这是静态回归，不冒充模型语义行为保证。
- 保留1.2.0已交付ZIP；新版独立重建、解压验收，真实profile装载仍需官方安装成功。

# 1.2.0 · 2026-10-25

## 新增与修补

- 本地结构化checkpoint/restore：工作区与真实会话绑定、SHA漂移、两版回退、限额与取消锁存，显式跨会话选取。
- 检测上下文替换后先restore，阻止空语义覆盖及明确关键写路径；是记忆流程门而非授权。
- 学习/检查点采用公开sessionQuery只读观察租约并释放，不新增生产snapshotEvents。
- SQL补括号/布尔恒真反例；后台纪律不再接受环境开关或Shell前台键盘注入的静默豁免。CLI缺字段/畸形/超长输入fail-closed。
- 配置枚举复核：提问为legacy而非无效blocking；补js-yaml真实MIT许可与最终解压验收。

## 其余本轮改动

- 正式package/locale/icon/exports/files/cordis.patch bundle；新增可选jizhi，不覆盖现有模式或目标机规则。旧安装/卸载覆盖路径关闭，默认只读预演。
- 工具分页目录/激活器同构，未完成/错误激活不计；native只列inactive摘要，不重复resident签名，LRU可重载。
- 技能实时采集统一，BOM/quoted/folded/literal元数据与重复来源保留；查询不建索引，错误exit2与NO_MATCH exit3分开；索引检查与tier检查同源。
- 高影响执行前预检用tools.guard与可释放effect，异常拒绝；win_bash覆盖，SQL逐语句/深度检查，legacy PS调用同一核心。
- 取消/AbortError撤销pending和旧timer generation；预算不强行抬高，审批intent不可自动选择。新模式默认不叠加兼容自动续跑/自动选择。
- 接续任务以session+cwd作用域过滤，只比较本scope内容；规则提醒从唯一标记块提取。周检同时查字节与行数，区分静态接线与真实触发。
- 持续学习：选中jizhi后自动按真实当前会话复盘、有界去重/隔离/脱敏；可验证分派事实、明确偏好与pending改进候选分层。规则/技能/hooks/MCP候选不自动放宽权限或修改凭据。
- 通用验证技能脱离单一项目；Office优先检查宿主随附Python与库，不再假称缺包或自动npm安装。保留低频脚本/参考能力，不以精简名义丢失独有功能。

## 验证边界

替身测试、资源闭包、真实宿主装载、实际模型工具投影和视觉验证分别记录；没有做的层不写通过。高级Office排版/修订/批注/转换能力没有因库存在而被认定全面验收。SQL是有限预检，不代替数据库权限和人工影响面确认。

不附带作者凭据、个人经验库、模型配置或HiATMP本机项目参考。最终文件和ZIP以FILES.sha256及交付校验记录为准。

## Ultimate-Model share add-on identity

This redistributed copy is rebranded to `@local/ultimate-model@1.4.2` with preset id `ultimate-model`. The upstream `@local/dsh-jizhi@1.4.2` source and existing installed bundles are not changed. The internal skill name `jizhi-mode` and tool APIs remain unchanged.
