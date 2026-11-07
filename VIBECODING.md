# DSH-Optimization 本轮开发与验收

## 目标与授权

验收用户提供的 Ultimate-Model，适配 Qoder 与 Codex 最近有效方法，修复真实部署问题并部署到用户 DSH；随后创建 Public 的 DSH-Optimization 仓库。保持现有账号、模型、用户定制、停用状态和活跃任务。原始附件文档只作审查资料。

## 基线与取舍

输入 Ultimate-Model 1.4.3-review.2，SHA256 730c69584c7cd57a953782533459d00503c00e40a2a661414125a1a374110b67。Qoder v0.0.30 本机与远端 main 同为33386f97bba86a852d90c9ade14222024d91adaa。采用按需索引、模型语义选择、分段验证、最小可恢复事务与独立实体包验收；复用 DSH 小内核，不移植 Qoder hook/SQLite/客户端配置。

能力选择示例：USE 现有技能、宿主工具与独立审查；SKIP 新常驻分类器、重复 native provider 和第二套压缩器；NEEDS_FACTS 现役进程实际采用状态；ASK 只有需要额外维护窗口或当前授权外的动作。候选跳过不取消强制验收。

## 分段计划与证据

| 段 | 产出 | 本轮状态与证据 |
| --- | --- | --- |
| A 来源/三方审查 | 原始包保存、差异、真实 SDK 契约 | 已完成；输入与本机安装包原先202文件相同 |
| B 修复 | 禁存判断、索引/状态/物化事务、路径/文档 | 已修；准确并发窗口首红→绿，最终包回归单列 |
| C 独立实体包验收 | 新解压、安装、实际 SDK、浏览器关键路径 | 最终review.6 ZIP独立校验214清单/215成员，311测试全通过；正式SDK、headless UI模式/工具/取消/禁存及journal通过，模型为离线fixture；官方管理器独立安装/卸载通过 |
| D 本机部署 | 可追溯备份、保留策略、唯一注册、采用读回 | review.6及增量守卫已部署并正常重启；全局规则原像备份/prefix保持及KEEP读回通过；临时验收配置已清理。第三轮续任务在20次/300秒新增预算内以11次/103.662秒完整通过，实际RED→GREEN、VIBE及独立13+23用例通过，原3保护文件不变；前两轮共12次失败保留；既有账号renderer日志单列 |
| E Public 交付 | 干净源码、分享ZIP、来源许可、远端字节 | 源码、完整文档、可选全局规则及独立预发布实装通过；0.1.2按固定提交构建，插件/脚本/规则与已验版本逐字节核对，独立查包后发布并下载复核。第三轮只证明此小型续任务，前两轮失败不回写 |

## 并行与唯一集成

主代理独占候选、部署、构建、最终文档与发布。独立审查代理只写各自证据目录；元数据 helper 等交付固定SHA后由主代理集成。离线独立SDK/UI和官方管理器验收只在新自有 home/profile 运行，不使用现役账号或真实模型请求；用户先后批准前两次各6次SDK主请求/300秒，以及第三次最多20次/300秒；第三次保留已批准的适配器内部HTTP重试，实际11次，三轮累计23次SDK主请求。内部HTTP次数/账单未统计，不作同义换算。第三轮只有一条真人任务消息，主集成者不追加指导、不改验收产物；独立验收者只读核对journal、保护文件与真实复测。共享接口、包、清单与最终集成串行。

## 已知风险与反例

- 缺少可选 computerUse 注册服务时，无条件 native 子插件会使整个模式 broken；真实 profile 还显式关闭 native，因此不能用presence条件绕过。最终去掉预设私有 driver，沿用宿主唯一 provider与开关。
- 多文件事务是应用级可恢复协议；中断/并发可留下stage/lock，按恢复记录处理，不能盲删。committed清理失败不回退已提交目录。
- 预览说明是官方模态，用正常Continue关闭后验证模式；不能force点击或屏蔽inert来宣称修好。
- 测试、fixture、真实SDK/工具执行、现役采用及外部provider分开。未跑或跳过不计通过，旧证据不覆盖新包。

## 交付流水线与剩余验证

本版本沿固定源码提交 → 新clone构建完整ZIP → 独立解包验收 → 发布与远端源码/附件字节核对交付，关联见发行页与同版本机器回执。第三轮最终辅助另经原装SDK注册RED/GREEN、16项策略测试和完整Host离线链验证后再实跑；真实续任务已完整通过，不覆盖前两轮失败。新增20次预算实际消耗11次，未用9次不继续消耗；本任务不再追加付费调用。0.1.2只更新版本、文档和脱敏证据，插件、脚本及可选规则不改字节，沿用相同字节的311/16/SDK/UI实装证据；不为报告变化重复模型请求或未变代码的全套测试。更大业务长任务、跨平台和任意并行写仍未验。最终状态以 docs/acceptance.md 及同版本机器回执为准。

## v0.1.3 双语说明与实例变化

用户补充要求README、发布包说明参考Qoder并采用中英双语。0.1.2原提交、tag和ZIP保持原样；0.1.3增加双语README及六份英文核心说明，中文页互链，Release同样双语。原插件、脚本、测试和通用规则字节不变；翻译草稿由独立代理各写私有目录，主集成者唯一写入公开源码与发布产物，集成后重新查链接/语言事实及归档，不重跑未变311/16/SDKUI或收费模型。

最终只读复核发现旧run已clean结束、DSH另有新实例运行；保留旧证据并单列新实例的相同版本/清单/配置和三个启动健康事件。新快照12条error仅做脱敏技术分类，根因UNDETERMINED，不能把旧1条错误结论套用，也不推测与本包无关。未读当前用户会话或账号值，未重启新实例。真实第三轮11/20及历史累计23次保持原记录，本任务不再发模型请求。


## P6 / 0.1.4：原12条运行记录修复与交付

原始12条已从实际技术日志、调用链和有界工具记录分类，原快照及旧版结论作为历史保留。它们不是12个独立程序缺陷：1条是官方账号profile HTTP403，10条是Bili状态轮询CORS，1条是预期的无界读取守卫拒绝，后续3次有界读取成功。当前UM6没有重复native provider；没有证据将这三类错误归因于UM。本轮没有改动UM6、工作流安装器、通用规则或既有守卫。

| 本轮层次 | 实际结果与边界 |
| --- | --- |
| 新修复器回归 | `node --test scripts/tests/bili-status-cors.test.mjs`：7/7、exit0、0失败/跳过 |
| 便携事务验收 | `verify-bili-status-cors.mjs`：原始与已修源各15/15；主集成者另用原始源15/15、sourceUnchanged=true。全部写入独占夹具，不执行第三方包 |
| 正式最终产物浏览器 | 完整CLI输出SHA `7a4185d855452c04bd15e7a63b490780f5f1ee8f550658b6953283037ecab611`，提取11个实际函数；独立Chrome10项+Node门禁14项通过，24GET/0OPTIONS。原版两项CORS首红保留；400/404状态码不变、JSON可读，非法Host/Origin仍403、无ACAO。pageerror=0，2条预期HTTP资源错误保留 |
| 本机正式应用 | 05:38:16Z在正常停机后执行精确字节修复；新目标nlink=1，pnpm原hardlink alias的字节/mtime不变，永久备份和恢复receipt保留，syntax exit0 |
| 现役服务采用 | 新Host启动的独立proxy进程及实际index路径已核；真实产品服务可信`dsh-app://app`请求400带精确ACAO，非法Origin仍403/no-ACAO。版本仍0.1.212，不用版本号单独证明采用 |
| 原生桌面受影响路径 | 05:45:54Z在实际`dsh-app://app/`打开Bili上下文视图，读取空会话HTTP404，未显示Failed to fetch；这与纯Node响应头、HTTP-origin Chrome夹具分开记录。未运行Bili模型任务 |
| 账号正常产品路径 | 一次正常认证的`account/getProfile` RPC为HTTP200/ok=true/value.status=failed；原装白名单日志在05:41:22.349Z确认公共profile请求仍403/network。账号问题**未修复**，不把RPC200当上游成功，不推断断网/过期或清凭据重登 |
| 保护与清理 | 临时诊断行清理回原Home SHA，opaque URL文件按精确hash删除，再正常重启；旧配置、默认模型、停用选择和数据的最终读回单列。协调者新增受控模型验收0次（正常业务流量未计数），历史23次预算记录不变 |

详细命令、字节范围、回退和许可见[运行修复指南](docs/runtime-repairs.md)与[机器可读摘要](docs/evidence/acceptance-summary.json)。原10条响应的具体HTTP状态未记录，不能断言当时全是404；现役确证的是修复后受影响路径。布局恢复阶段另保留周期性同类`ResizeObserver loop completed with undelivered notifications.`通知，不宣称控制台零错误。账号403属于仍开放的上游读取边界，现有数据/凭据保留，不通过禁用防护来隐藏。

当前任务不自动恢复其他业务会话、不新增付费模型请求。最终分享包按固定提交、新clone、独立验收、远端四资产字节核对交付。

## P6补充：兼容边界与真实RO门禁

分享包review.7只改5个元数据/说明，210文件保持review.6；兼容上限为<0.2.2-0。源码固定提交e7e2a3575242fa76ea4a4efd0024779b0f6abf95，独立克隆构建UM7 ZIP为705741B/215成员/SHA 8c54ee1dcc743da180531166a2ac7f29d76a2b46319daf0078805506a150da0b。现役仍UM6，未直接升级新SDK。

06:17:38Z正式footer修复已正常部署，精确源与原payload/EXE/unpacked/保护配置核对通过；独立Chrome14+VM6及源码4/归档4/完整归档8通过。实际新实例至06:25:30Z仍RO8+账号1，CORS0，零RO门禁失败。06:52:25原生读回仍停止生成，保护活跃任务，不重启/改现役探针或UM。私有探针总3条日志/8192B/300秒，经复核后仍须明确当前维护条件，且永不分发。协调者新受控模型调用0，正常业务流量未计数。

## P6 / 0.1.5：获准维护、探针边界与UM7采用

用户后续明确批准一次维护窗口，原活跃实例正常结束后才执行。有限私有探针未观察到READY或诊断，按NO_READY/来源未验证保留，正常停机并在期限内恢复正常ASAR；不把0条输出算成修复成功，不全局吞RO错误。实际main对console.info的收集存在developerLogging条件，原因判断须保留配置读回和执行采用边界，不能只凭无日志猜测。

现役UM7仅五项元数据/说明经备份、逐文件CAS应用，正常重启并独立读回214项清单；执行代码和物化patch未改。0.1.4的HOLD是已冻结的当时状态，此次获准维护已完成；新的维护仍按当前任务和权限判断。旧生产RO门禁失败、账号403及311/16/SDK/UI的历史范围不改写。新原生采用与最终观察见验收报告；未新增受控模型请求，现役正常业务流量未计数。旧ZIP/tag不覆盖。

One later explicitly approved window allowed maintenance after the active instance ended normally. The private probe is NO_READY/owner unverified, not a successful diagnosis; the normal carrier was restored within the deadline. Live UM7 adoption changes only five metadata/document files, with backups/CAS and 214 matching manifest entries. The earlier 0.1.4 HOLD, failed production RO gate, account403 and unchanged-code evidence remain historical records. New native registration and bounded observation are separate; RO recurred after this maintenance. No new controlled model acceptance is claimed, and earlier assets/tags remain immutable. Further private diagnosis requires a new explicit time/log budget rather than an extension of the spent window.

### 第二窗口截止首红

用户另批180秒/含READY总3条/8192B；v4实际READY可见，但正常结束前运行190.421秒，超预算10.421秒，恢复比07:48:46.000Z硬截止晚16.128秒。协调者未按计划提早停机，保留FAIL与恢复回执，不将私有9/40夹具通过当实装时间门禁通过；已说明且不再探针。正常1c3b载体/UM7恢复后新实例的观察另列，不能沿用前一实例绿色。

The second explicitly approved 180-second window recorded READY but exceeded the runtime allowance by 10.421 seconds and restored 16.128 seconds after its planned hard deadline. The deadline gate is FAIL, independently of fixture success. No further probe will run; final normal-instance evidence is a separate layer.

最终normal全run为93条记录、error3=账号1+RO2；其中原生Bili07:51:53Z至07:54:41.886Z共168.886秒，阶段内账号0+RO2，CORS/未知/工具/模块/crash0；RO未解决。V4退出expectedtrue但ACKfalse/SIGTERM，保留EXPECTED_HOST_EXIT_WITHOUT_SHUTDOWN_ACK；官方quit和run.end clean不冒充完整graceful/全任务数据保全。六项opaque保护和UM7清单是有限范围，无新增受控模型轮次或后续探针。

The complete final normal run has93 records and3 errors: account1/RO2. Its168.886-second native-Bili phase contains account0/RO2. V4's expected Host exit lacked a shutdown ACK and used SIGTERM; the clean marker is not complete graceful-shutdown or all-task-data assurance. Scoped hashes and UM7 manifest checks remain separate evidence.


## P7 / 1.0.0 正式交付（进行中）

目标：继续修复账号403、ResizeObserver、Host关闭未确认；保留现有配置和数据，完成本机真实部署、双语文档和正式实体包。用户后来将Bili目标明确改为只保留18787，并要求登录自启及守护。原8787方案未执行。本阶段仍有真实运行门禁开放，不能把代码/夹具通过写成全面完成。

仓库、现役、构建和发布由主集成者唯一写入；代理只在私有owned目录审查、生成候选和独立验收。公开路径不得包含私有探针、完整应用模块/ASAR/EXE、凭据、个人配置/会话/日志或真实实例标识。

### 已完成的当前层

- Ultimate-Model1.4.4最终R2实体为706264B/215成员，SHA256 `df5e278f9339f6b0cee512a577db8ddcceda5687a04a02d15ec3fb09b1872c52`；214清单匹配。相对portable review.7只有五项元数据/说明变化，210文件及全部执行代码保持；prepared本机patch另有保留基线，不混用原ZIP和已物化文件。最终README换行修正仅影响README/FILES；311项回归关联精确相同代码/测试闭包，官方CLI管理器新解包安装/选择/取消/移除另验。
- 自动诊断守护第200001ms启动退出，212639ms确认同EXE进程消失，226648ms恢复正常包，226649ms完成，低于300000ms；两条元数据/1380B。早先V1终态schema拒绝自动恢复及旧180秒超时均保持FAIL，手动恢复不冒充自动通过。所有私有探针已移除，本阶段不继续延长其预算。
- 输入栏原装函数+实际CSS的Chrome反例确认同步RO布局缺陷，局部RAF修复与生命周期/断点检查通过，不替换全局observer、不吞错；正常运行的有限观察暂未见RO，未宣称全部历史来源和长期行为已证明。
- 正常运行修复器R2以精确字节支持original/footer/e8三路径到同一正常ASAR `90c23c91ddff8e1306cfeb17e4546e8e3e708721dd2fba5a82500d6655dc8f88`，193619745B；9项回归、完整尺寸实际CAS/KEEP/恢复和官方ASAR读回通过。Cordis4.0.5所有权回补保留原并行清理，原装两项死锁反例、候选16项及真实SDK Peer/WS4项通过；短变换、Shigma原MIT与DeepSeek许可分别保留。
- 用户在新鲜UI再次显示业务生成后，另行明确批准第三次最多5分钟正常维护。维护起点2026-11-07T11:39:35.362Z；旧DSH/代理均正常退出，四份代理session文件12567900B作opaque备份。native严格18787/配置三字段/旧看门狗仅告警均有永久备份、CAS和独立读回；pnpm原alias及独立global native原件保留。正常应用最后启动11:44:10.521Z，275159ms内，未新增私有探针或受控模型请求。
- 独立读回正常90c23/EXE、三个修复成员、UM214、七项opaque保护、三个源目标与alias/global原件通过。配置只输出port/attachUrl/attachPolicy，其他值保持，不导出凭据或配置指纹。现有模式、停用选择、工作规则和数据目录不整体替换。
- Bili独立代理在18787由守护实际启动，HTTP200、unarmed，并在DSH退出前后保持同一进程。可信dsh-app状态400/空会话404均有精确ACAO；非法Origin仍403/no-ACAO。这是HTTP读取层，不冒充真实模型压缩或当前renderer读取。
- 本机任务采用当前用户登录+10秒、每分钟无限重复、IgnoreNew和全局互斥。仅RestartOnFailure的第一次实测未恢复，保留FAIL；周期触发的第二次仅停止自有guard后37.4607秒自动恢复，Bili和DSH未被停止。内核socket owner为0，只能报告自报健康与进程来源/创建时刻关联，不能冒称kernel owner通过。
- guard最初CIM5秒在本机反复安全BLOCK_UNKNOWN，独立反例先修身份/argv/预算/总health超时，再仅将CIM操作参数5改10；当前源 `e9575220eebc2020077365c8615dd3901c774085835ad88c34e916249af828f2` 有独立12边界关联与本机pause/CAS/恢复。有限533746ms/9heartbeat观察中0BLOCK，不证明所有CimException的根因或长期稳定性。

### 仍开放与下一步

- 官方profile仍403/HTML/CloudFront，原凭据与failed保持；近期官方同请求协议无可移植恢复补丁，具体edge/WAF/源站原因未知。不通过伪造身份、清凭据或盲加重试隐藏失败。
- **真实Host ACK仍FAIL**：已部署90后的正常退出约3秒内部SIGTERM、expected:true/acknowledged:false；clean:true与所有进程退出不证明完整优雅关闭。完整真实HTTP/WebServer/Peer/Mux隔离图和负对照正在定位具体owner，不能把框架回补当此现役原因已修，也不盲毁renderer/延长timeout。
- 后续技术日志出现subagent重复注册；实际SDK在原装/R4两种Cordis都复现composition卸载漏agent-owned inject fiber，最小生命周期修复与独立回归进行中，尚未新部署。ACP一次7ms空错误经13项源码链检查仍未归因；unarmed共享不是拒绝条件，不能统称冲突或通过。progress_update的INVALID_ARGS按参数拒绝分列。
- 本轮维护预算已用完；现役继续工作，不自动中断新业务、不新增付费模型或私有探针。后续源更新先完成候选与独立验收，再按自然空闲/适用授权部署。
- 完成具体修复/剩余边界、双语README/验收/schema2同步后，固定提交→新clone构建→精确ZIP独立解包与官方安装→Public正式发布→远端源码/命名资产字节核对。当前尚未发布1.0.0；旧0.1.5及更早tag/资产不覆盖。

The formal community release remains in progress. Actual normal deployment and scoped configuration/data preservation are independently verified; the five-minute maintenance ended within275159ms. One standalone Bili proxy on18787 survives DSH shutdown, and the periodic task recovered only its own guard in37.4607 seconds without manual start (the receipt unit is37460.7009ms). Previous automatic/deadline failures remain immutable. Official account access and the native Host shutdown ACK are still failed boundaries. A separately reproduced SDK subagent lifecycle leak is being repaired; ACP remains unclassified and invalid tool arguments are distinct. No further paid model requests, private probes or unapproved active-task interruption are inferred. Release requires fixed source, independently accepted exact archives, bilingual evidence and remote-byte verification.


P7 continuation update (2026-11-07): R3 normal13a and its optional public utility are independently validated on owned full-size copies (11 units, four byte conversions, five bad-receipt rejections, actual90→13a→90 CLI). The deployed app remains normal90; HostACK/403 remain FAIL and ACP causality remains unproven. Another active task added Bili attribution logs after M3; the user explicitly requires preserving that edit. No new app shutdown/probe/model budget is inferred. M4 is a pure timing plan only, not a built/executed controller or authorization. The final integrated gate passes79/79 with zero fail/cancel/skip/todo,54.864seconds; the earlier78/79 Host-readiness fixture race and its deterministic original-RED/candidate-GREEN are preserved. Source freeze, exactZIP acceptance and remote publication are recorded separately in the release receipt.
