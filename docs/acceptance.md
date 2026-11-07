# 验收报告：0.1.5 / Ultimate-Model 1.4.3-review.7

[English](en/acceptance.md) | 简体中文

现役Ultimate-Model已在本次明确获准的维护中更新为`1.4.3-review.7`；仅五项元数据/说明变化，其余210文件及全部执行代码保持review.6字节。0.1.4中记录的“现役review.6 / 维护HOLD”是当时的快照，后续批准及本次完成事实见[验收报告](acceptance.md)。这不构成后续维护的长期许可，也不自动延长已经使用的诊断预算。

验收日期：2026-11-07（Asia/Shanghai）。实现和本机部署由主集成者负责；最终插件 ZIP 由独立验收者重新解包、安装副本并运行 SDK/UI，官方管理器另由独立验收者验证。所有测试都在同一台用户 Windows x64 机器上；“独立”指职责、解压目录与 Home/profile 隔离，不代表另一台机器。

[机器可读脱敏摘要](evidence/acceptance-summary.json)与本报告使用相同分层。第三轮受控自主续任务完整通过，前两轮仍按失败保留。0.1.4新增可选Bili窄修复器及当前独立回归/浏览器/本机证据。review.7的5项元数据/说明另验，其余210文件与review.6相同；原工作流安装器/规则及其测试字节未变；既有311/16/SDK/UI证据只关联这些相同字节，不宣称重新执行。最终新归档另按固定提交独立解包验收。

## 0.1.5：获准维护后的现役读回

本节追加后续事实，不改写0.1.4冻结的账号403、生产RO零通知门禁失败或当时的活跃任务维护HOLD。用户后来明确批准了一次维护窗口；旧实例于2026-11-07T07:23:11.575Z正常结束。该批准仅覆盖这一次受控维护，不成为中断其他活跃任务或继续扩大诊断的长期许可。

携带私有有限RO元数据探针的临时实例于07:23:55.727Z启动，07:28:04.663Z正常停止，07:28:41Z前已恢复上一轮采用的页脚修复ASAR；恢复在五分钟期限前完成。日志中READY、诊断和RO记录均为0。结论为 **NO_READY / observer owner UNVERIFIED**，不是探针成功，也不是RO根因已修复：未观察到READY时，不能证明诊断链路已产生可用输出。独立读回确认既有developerLogging=false，实际main会过滤console.info；该可观测性条件成立，但仍不能据此证明探针实际执行过、它是无输出的唯一原因或已定位observer来源。没有为诊断打开developerLogging，也不能仅凭0条日志推断代码未执行。探针及临时诊断代码不进入公开分享包。

07:29:22Z通过逐文件CAS将现役UM从review.6更新为review.7，五项元数据/说明文件有独立备份和事务回执。执行代码未改，物化patch字节保持；独立初步读回214项清单匹配，现役FILES.sha256的SHA为`8e1e6ef30bc2e170c670ec10b794fe878ae6ad1ac3d19e3bda9b78fcd1818be1`。随后正常启动。正常载体仍为ASAR `1c3bc0c92100688532e43173e51d93bcc07350dbcb18a9be65e5346504203fe4`、client `680d4dbd4594145c92a7a571ce044862f8bd326bc839873ff13653c4e8e50f46`，Bili修复字节仍为`7a4185d855452c04bd15e7a63b490780f5f1ee8f550658b6953283037ecab611`。

本版没有新增受控模型验收请求。现役正常业务流量未统计；历史三轮23次SDK主请求保持原记录。未变代码的311/16/SDK/UI证据继续按原字节关联，不宣称本次重跑。新的原生采用和最终观察单列，后续窗口仍有RO复发，不能抹去旧门禁失败或证明根因已解决。

### 第一窗口后正常实例的独立观察（历史）

正常实例从2026-11-07T07:29:23.960Z启动。原生可见证明时间为07:31:36Z，独立观察截至07:33:54.585Z，覆盖其后138.585秒。该轮累计3条error＝账号读取1条＋RO通知2条；两条RO于07:33:41.348Z和07:33:41.352Z在原生可见阶段再次出现。CORS、unknown、工具错误、模块错误和crash均为0，三项启动健康事件齐备。因此**生产RO零通知门禁仍失败，账号问题仍未修复**，不能将维护、UM7安装或Bili可读状态当作全部运行问题通过。

07:35:40Z的独立源读回再次确认正常ASAR/client/EXE及Bili修复字节稳定。UM7清单214项、五项元数据的备份和现像、其余210文件及原物化patch匹配；原先约定的六项配置/数据保护哈希匹配。凭据仅作opaque字节校验；这不是全量用户数据或后来业务写入均不变的声明。原业务显示暂停及恢复控件，协调者未代用户恢复生成。

### 两条UM显示记录的身份核对

原生插件页显示的两条“查看Ultimate Model”记录不是两个同时启用的预设：旧Home记录停用，受管review.7 bundle记录启用；同一preset配置id只有一条启用，未发现外部记录覆盖受管行，UM声明的native provider数量为0。保留用户的停用选择，没有为“清理重复”切换或删除记录。该结论是注册/启停身份核对，不代替一次新模式选择、新会话fiber或模型请求的采用证明。

### 二次获准探针：READY可见，截止门禁失败

第一窗口已使用后，用户另行明确批准180秒、含READY总计最多3条日志、8192B的新窗口。私有v4只调整诊断可观测性，未打开developerLogging；其实际main桥接9项及Chrome40项夹具通过，不替代实装计时门禁。

此次实际记录到READY（07:45:53.936Z），证明该实例的初始化记录点可见；不能由此认定RO来源已经定位。ERROR级V4诊断标记应与真实应用错误分列。07:48:33.902Z的收集快照仅覆盖当时，不能代表结束前余下时间；随后完整结束回读共103条记录，确认本轮仅1条READY、28B，DIAG0/RO0。这里的103条是运行记录总数，不是错误数。未复现RO owner。

| 实装计时项 | 已确认值 | 判定 |
| --- | --- | --- |
| 新授权运行上限 | 180秒；总日志3条/8192B | 独立于已使用的第一窗口，不自动续期 |
| 临时实例起止 | 07:45:46.527Z—07:48:56.948Z，run.end标记clean:true（Host未ACK，详见退出边界） | 190.421秒，超过运行上限10.421秒 |
| 约定硬截止 | 07:48:46.000Z | 未按计划提前停机，截止门禁FAIL |
| 正常载体恢复 | 07:49:02.128Z | 比约定硬截止迟16.128秒 |

**本轮维护不能总括为全部合规或全部通过。** READY可见与截止超时是两个独立结果；不得以日志条数仍少或私有夹具绿色覆盖这次真实超时。超时首红及恢复回执保留，已向用户说明，不再运行探针。已恢复此前采用的页脚修复ASAR `1c3bc0c92100688532e43173e51d93bcc07350dbcb18a9be65e5346504203fe4`，保留现役UM7，并于07:50:16.761Z正常启动。最后正常实例的采用与至少120秒独立观察须按新的起止窗口单列，不沿用前一实例的结果。

### 退出回执与数据保护范围

V4完整结束记录中，07:48:56.933Z的Host退出为`expected:true`、`acknowledged:false`、`signal:SIGTERM`、`exitCode:null`，分类为 **EXPECTED_HOST_EXIT_WITHOUT_SHUTDOWN_ACK**。协调者使用的是官方退出入口，没有另发操作系统kill命令；但实际SDK的`stop(false)`路径在等待约3秒后仍可发SIGTERM，严格`requireGraceful:true`路径则会拒绝未ACK。因此`run.end clean:true`只是一项生命周期标记，不能证明Host完整优雅退出或所有任务状态均已安全落盘。

这条原始退出记录与error计数保留，不新增推断成另一个独立产品缺陷，也不作为崩溃或完整graceful通过。已核对的六项opaque配置/数据及UM7字节是有限保护证据，不等于全量用户数据或全部任务完整性证明。没有据此盲改核心、吞掉日志或再运行探针。

V4完整103条记录中保留3条raw error级记录：READY专用诊断1条、账号读取1条、预期Host未ACK退出1条；DIAG0、RO0、未分类0。不把READY算作新增应用缺陷，也不从原始error总数中静默删去它。

### 最后正常实例的原生Bili状态路径

07:50:16.761Z正常启动的新实例在07:51:53Z，以真实`dsh-app://app/`来源从对话的更多视图入口打开Bili上下文视图（`bili-context`），实际读取HTTP404，未显示Failed to fetch。此证明针对已识别的Bili视图，不把通用“上下文洞察”侧栏当作受影响路径，也不以HTTP-origin Chrome或Node响应头对照冒充原生采用。未运行Bili模型任务。

07:52:19Z的正常载体/UM7清单读回通过；07:52:27Z已恢复原对话tab，原任务仍提供恢复控件，没有代用户恢复生成或发送新提示。**本次未重测一次新的预设fiber选择**；模式完整SDK/UI行为继续按先前相同执行代码的历史证据关联，不宣称新的会话或模型轮次。以这次原生Bili证明为起点的至少120秒独立日志计数由最终回执另列。

### 最后正常实例的独立观察

以07:51:53Z的实际原生Bili证明为起点，独立观察截至07:54:41.886Z，覆盖168.886秒。该正常实例完整冻结日志共93条记录，累计3条error＝账号读取1条＋RO通知2条；这168.886秒原生阶段内为2条RO、账号0条，不把启动时的账号记录重复算入该阶段。RO于07:54:41.546Z和07:54:41.550Z再次出现。CORS、unknown、工具错误、模块错误及crash均为0，三项启动健康事件齐备。**最后正常实例的RO零通知门禁仍失败，账号问题仍未修复**；原生Bili状态路径通过不等于全部运行问题通过。

正常ASAR/client/EXE及Bili修复字节、现役UM7的214项清单和此前约定的六项配置/数据保护哈希按独立最终回执核对。凭据只作opaque字节校验，保护范围不扩张为全量用户数据、所有任务状态或后来业务写入均已校验。V4的专用ERROR诊断标记与真实故障分列；不同实例的计数与观察窗口不混合。

独立最终来源读回时间为07:57:14.076Z；日志计数仍严格截止07:54:41.886Z，不外推后续时间。

## 已冻结的插件字节

- 文件：`Ultimate-Model-1.4.3-review.7.zip`，705741 字节，215 个归档成员。
- SHA256：`8c54ee1dcc743da180531166a2ac7f29d76a2b46319daf0078805506a150da0b`。
- 精确清单：214 个被校验文件，另有 `FILES.sha256` 自身；归档 CRC、安全路径、大小写冲突、链接与清单集合均通过。
- 插件结构：55 个技能，25 个组合插件行。原始输入 1.4.3-review.2 的 SHA256 为 `730c69584c7cd57a953782533459d00503c00e40a2a661414125a1a374110b67`；原件保留。
- 完整分享 ZIP 另含可选全局规则、安装器及本报告；其最终 SHA256 由同名 `.zip.sha256` 和发行页给出。本报告不嵌入包含自身的 ZIP 哈希。

## 历史review.6通过的验证层

| 层 | 实际入口/动作 | 结果与边界 |
| --- | --- | --- |
| 插件静态检查 | `node scripts/prepare-install.mjs --check` | exit 0；只读清单、模板与资源核对 |
| 插件独立回归 | 新副本 `node scripts/prepare-install.mjs --tests`；临时目录位于 Home 之外 | 311 pass，0 fail/cancelled/skipped/todo，exit 0；主集成者也在候选执行311项通过 |
| 真实 SDK 启动 | 原装 DSH NEXT 2.0.20-next / SDK 0.2.1-rc.3，独占 base+web-app+本包 | `ultimate-model` 解析正常，无 broken；无旧 Home 影子注册 |
| 真实 Host/UI | 独占 loopback Host、系统 Chrome headless | 正常关闭预览说明后模式可点选；所选会话真实组合为 ultimate-model；刷新后保持 |
| 实际文件工具 | 确定性离线模型 fixture 驱动正式 write/read | 工具真实执行并读回29字节，SHA256 `472ba4bb2cdb7f7d4a9b445956f40af5b2bdf7243289222dc4864a6cff097a68` |
| 停止路径 | UI 正常点击停止 | fixture 收到 AbortSignal，正式 journal 为 aborted/user；未自动复活 |
| 禁存路径 | UI 输入“本轮不落盘”，执行生产 jizhi_context.save / jizhi_experience.review | 均返回 PERSISTENCE_DENIED；既有经验与检查点字节、哈希、mtime 不变；默认停用 local_memory 未冒充实际工具验证 |
| 官方本地目录安装 | SDK PluginManager.installBundle/listBundles/removeBundle | pnpm11.7.0 JS发行版，离线且不执行依赖脚本；安装exit0、restart-required/no-hmr、warnings=[]；保存link绝对路径，8/8资源存在于真实安装root；卸载exit0，依赖、选择、链接、列表、lock引用均移除 |
| 全局工作规则 | `node --test scripts/tests/workflow-overlay.test.mjs` | 16/16，0失败/跳过；合成 Home 覆盖原字节、备份、重复应用、定制保留、并发改变、链接及坏输入 |
| 本机规则安装 | 显式目标 Home 的 `install-workflow.mjs --apply`，主集成者对精确旧受管块的受控维护升级及默认只读检查 | 13587原始字节逐字保留、每次完整备份读回一致；追加EPERM实测判据后15830字节，最终再查 KEEP；公开CLI对不同或定制块仍返回REVIEW_UPDATE，不自动替换 |
| Windows测试子进程EPERM | 原装SDK的同一只读沙箱、同一单测试文件 | 原 `node --test` spawn EPERM/exit1；`node --test --test-isolation=none calculator.test.mjs` 完整4/4通过，含保护文件写入必须失败；未提权或放宽沙箱 |
| 本机守卫 | 保留原有前台许可模块、只补真实编辑工具字段和递归删除覆盖 | 原有守卫27项测试通过；UM包另有跨模块单次许可、过期/身份/取消反例 |
| 本机部署 | 停机备份、逐文件预像检查、更新已登记的link目录、正常重启 | review.6 已安装；实际进程记录 process.ready、host.start.complete、renderer.recovery.healthy；原有停用选择、账号、模型和其他bundle保留 |

SDK/UI 层的模型是离线 fixture，外部 Provider 请求为0；这是正式工具/状态/界面链的证据，不能解释为模型质量或真实账号联网通过。该层未捕获 pageerror，记录到一次主动刷新带来的 `/plugins/events` SSE `net::ERR_ABORTED`；没有安装 console.error 监听器，不能宣称所有控制台错误为0。Host 与浏览器已正常关闭，独立检查残留 owned Host 为0。

[隔离 SDK/UI 验收截图](evidence/isolated-sdk-ui-fixture.png)仅包含合成任务；图中明确标为 Offline audit fixture。实际 Provider 验收另列，不以截图中的完成文字充当模型实绩。

## 真实模型专项

**第三轮受控自主续任务完整通过：11/20次SDK主请求、103.662/300秒。** 从前轮已有的两份DSH代码继续，单条真人任务消息，运行中没有协调者追加提示或代改产物；模型实际跑测试、故障注入→恢复、完成VIBECODING，并以completed正常结束。独立核对真实journal、源码、保护文件及完整复测，结果为`PASS_CONTROLLED_REAL_MODEL_CONTINUATION`。

| 真实执行 | SDK主请求 / 时间 | 结果 |
| --- | --- | --- |
| 首轮 | 6 / 39.929秒 | 临时async guard违反同步SDK契约，7次工具均JSON准入错误，0/3产物；FAIL_BUDGET_EXHAUSTED_NO_ARTIFACTS |
| 第二轮 | 额外6 / 45.802秒 | 两份代码生成并独立13+23用例通过；临时白名单拒绝edit/命令后缀，缺文档且模型未跑测试；FAIL_BUDGET_EXHAUSTED_PARTIAL_ARTIFACTS |
| 第三轮 | 新增上限20，实际11 / 103.662秒 | 最终辅助的SDK RED/GREEN、16项策略测试及Host离线链重验后实跑；3/3产物齐备、完整续任务PASS |

第三轮真实测试顺序是：同进程13/13、exit0；默认隔离spawn EPERM、exit1；临时去掉有限性校验后13项中9过4败、exit1；恢复实现后13/13、exit0。四次均无跳过/取消。实际命令为`node --test --test-isolation=none calculator.test.mjs 2>&1; Write-Output "EXITCODE=$LASTEXITCODE"`，默认隔离诊断去掉同进程参数；未提权、放宽沙箱或删测试。4个失败含父测试传播，不当作4组独立输入。默认子进程EPERM仍存在，不将兼容路径说成所有EPERM根治。

独立验收者重读代码后执行`node --test --test-reporter=tap calculator.test.mjs`：13 pass、0 fail/skip/cancel、exit0；另5正+18非法输入用例全通过。最终精确6文件，原3保护文件哈希/字节/mtime全不变；代码和测试最终哈希与第三轮起点一致。模型新增VIBECODING为6773字节，包含目标、两段计划、真实命令/退出码、RED→GREEN和未验范围；独立者没有补写。

22个真实工具结果中20成功、2个可恢复错误（首次读取未存在文档、一次Get-FileHash超临时白名单）保留。当前SDK请求中全局工作流角色为user，UM常驻提醒角色为system；Vision Router active/entrySeen/fiberSeen均true。没有导出完整HTTP上下文或读取账号凭据。真实journal及辅助失败/修复的细节见[真实模型验收记录](real-model-validation.md)。

三轮总计23次SDK主请求，第三轮剩余9次没有继续消耗。用户明确允许的适配器内部HTTP重试沿用，HTTP次数/token/实际费用未统计，不能按SDK次数等量推算。前两轮失败不因第三轮通过而回写；第三轮是小型owned续任务，不是从零构建任意复杂项目或长期稳定的保证。

临时runner/budget已全部移除，Home patch恢复精确原字节并正常重启；正常DSH没有本次6次或20次上限。原全局规则13587字节保留，追加受管区块后的AGENTS总大小为15830字节，KEEP核对通过。恢复后记录process.ready、host.start.complete、renderer.recovery.healthy三个事件；既有`[deepseek-account] account read failed` renderer日志单列，该类错误早于review.6，不将Host ready解释为所有账号或控制台无错误。

无临时辅助的正常SDK窄验证另通过read→edit及带退出码后缀的原样pwsh命令，13/13、exit0、0模型/网络；保留两条ConstrainedLanguage启动stderr。此项不冒充模型自主交付，第三轮实跑证据单独保留。

## 0.1.4：原12条运行错误的追查与本机修复

原始12条已从实际技术日志、调用链和有界工具记录分类，原快照及旧版结论作为历史保留。它们不是12个独立程序缺陷：1条是官方账号profile HTTP403，10条是Bili状态轮询CORS，1条是预期的无界读取守卫拒绝，后续3次有界读取成功。当前UM6没有重复native provider；没有证据将这三类错误归因于UM。本机现役UM6、工作流安装器、通用规则和既有守卫未变；分享包review.7元数据另列。

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

最终无临时辅助实例从2026-11-07T05:46:44.779Z观察至05:52:08.191Z（本地13:46:44—13:52:08）：三个启动健康事件齐备，未观察到shutdown/crash或CORS；error共9条＝账号读取1条＋ResizeObserver通知8条（约每分钟一对），unknown=0。05:50:38Z再次在原生页面读取空会话404，05:51:40Z确认恢复原对话视图。六项配置/数据原字节哈希与备份一致，凭据仅作opaque哈希核对。周期布局通知仍开放，未全局吞掉错误；该窗口不代表之后永远零错误。

详细命令、字节范围、回退和许可见[运行修复指南](runtime-repairs.md)与[机器可读摘要](evidence/acceptance-summary.json)。原10条响应的具体HTTP状态未记录，不能断言当时全是404；现役确证的是修复后受影响路径。布局恢复阶段另保留周期性`ResizeObserver loop completed with undelivered notifications.`通知，不宣称控制台零错误。账号403属于仍开放的上游读取边界，现有数据/凭据保留，不通过禁用防护来隐藏。


## 桌面布局修复及仍开放的真实运行边界

已在真实2.0.20-next归档确认footer将ResizeObserver的contentRect宽度再次减去padding，且在回调内同步改布局。定点修复统一宽度计算、合并到requestAnimationFrame并补卸载清理；源码4项、归档4项、实际完整归档夹具8项和独立Chrome14+VM6检查通过。原隔离页7条RO通知变为0；无关异常仍可见。公开工具固定原ASAR/EXE及目标源码哈希，未知字节保留审查，不改EXE/fuse/安全配置。

06:17:38Z正常停机后已部署：ASAR `1c3bc0c92100688532e43173e51d93bcc07350dbcb18a9be65e5346504203fe4`，内含client `680d4dbd4594145c92a7a571ce044862f8bd326bc839873ff13653c4e8e50f46`。完整原归档备份和事务receipt保留，186919466字节原payload保留，2337个unpacked文件与原归档声明的integrity匹配；这不冒充独立的部署前物理文件快照。

**真实零RO门禁失败，尚未完全解决。** 新实例06:17:46Z至06:25:30Z仍有账号1条、RO8条，CORS0、未知0、崩溃0；恢复原对话后的148秒有4条RO。06:20:46Z原生dsh-app仍可读取Bili空会话404。已修复的fixture缺陷不能直接认定为剩余通知的实际根因。06:38及06:52:25读回确认现役有“停止生成”按钮；为保留正在进行的任务，后续诊断维护暂停，私有有限元数据探针未部署、不随包分发。此前授权正常重启不用于中断当前已确认的业务生成。

本轮协调者新增受控模型验收请求为0；现役正常业务请求未计数，不能将其说成全应用0模型调用。六项配置/数据在维护后按opaque字节哈希与备份核对；之后的正常业务写入应按当前归属保留。

## review.7兼容边界

官方DSH NEXT 2.0.22-next采用core0.2.2-rc.1并含破坏性SDK变更。原宽范围在实际SDK的includePrerelease判断下会允许该版本；review.7将范围收窄为`>=0.2.1-rc.2 <0.2.2-0`，不能写成仍允许rc的`<0.2.2`。官方管理器在安装依赖后、启用前和启动时检查兼容性，不承诺拒绝前零安装写入，也不创建allow-version豁免。现役DSH未升级，0.1.4冻结时review.7部署因活跃任务暂缓；0.1.5记录后续获准部署与单独验收。历史311回归、SDK/UI和真实模型属于review.6，210个未变文件可逐字节关联；review.7的元数据、归档和支持SDK安装另外验收。

review.7精确ZIP另用官方0.2.1-rc.3 CLI SDK验收：清单/prepare均exit0，离线/禁脚本官方安装→列表→bundle启用→停用→卸载通过，8项物化路径均位于独占link源，卸载后依赖/选择/link/lock/运行预留均无残留。操作均为restart-required/no-HMR，未启动Host、Agent、Provider、账号或模型。CLI app-boot与已安装桌面app-boot版本同为rc.3但源码SHA不同，故这是隔离支持SDK管理器验收，不冒充同字节桌面SDK激活。首轮harness误用id/name代替官方rowId/moduleName的失败保留，其fixture已由官方管理器卸载。

上游破坏性变更参考：[官方2.0.22-next发布说明](https://github.com/anywhere-labs/dsh-desktop/releases/tag/v2.0.22-next)。

## 修复依据与失败保留

- review.3 虽通过303个测试，独立真实SDK发现预设私有 native CUA 注册依赖缺失，导致整个预设 broken。去掉第二个 provider 后，最终 review.6 重新从冻结 ZIP 完整验收；未把旧成功当新证据。
- 多文件索引、层级状态、物化 patch 与清单改用同一输入快照、对象身份/哈希预像和可恢复发布；准确并发时点的首红保留。短暂 EPERM/EBUSY/EACCES 有限等待并反复核对归属，提交成功后的清理失败与提交失败分开。
- 安装便利入口先用 Node 内置模块校验清单，再执行包内脚本；外部下载来源与入口自身仍需要独立信任，清单不能自证来源。
- 明确“不落盘”同时约束自动行为和显式持久工具；不把引用、工具结果或继承历史当用户新授权。
- 官方安装探针第一次卸载误给 pnpm remove 传命令专属 flags，被拒绝。改为通用 `--config.*` 离线/禁脚本配置后完成同一profile卸载，未重复安装、未放宽边界；该失败属于探针，原日志保留。
- 模式拦截来自合法模态，正常确认/关闭后验证；Vision Router“稍后”只管本页，与持久已读不同。没有 force 点击、移除 inert 或关闭视觉功能。

## 兼容与未验范围

本轮工具链包括 Node24（包声明最低Node22），DSH core0.2.1-rc.3、Playwright Core1.61.1、系统Chrome及pnpm11.7.0 JS发行版。包的声明范围为core >=0.2.1-rc.2 <0.2.2-0；未逐个版本验证，也未验Windows ARM、macOS、Linux、UNC路径、file/tgz/registry复制安装与Desktop默认native pnpm的全部锁定场景。

索引关键词只召回候选，当前模型做 USE/SKIP/ASK/NEEDS_FACTS 语义判断；这属于工作契约与现有工具使用方法，不是新的强制分类器。VibeCoding文档、提示词优化和并行归属已适配到已有技能，没有引入另一套常驻模型、SQLite governor、压缩器或 native driver。

311项回归包含注入的失败/并发反例，不能证明所有机器的间歇性EPERM永远消失；真实部署与受控任务提供本机当前证据。有限形式的递归删除/凭据/读取守卫不能覆盖任意脚本、间接调用和逻辑错误。工作规则改善行为，不承诺模型永不提前结束、误判或改错。

未执行跨平台矩阵、真实业务项目长任务、任意多代理并发写、远程数据库/支付/生产环境、额外付费服务、CI及所有第三方插件组合测试。未验项不计通过。个人Home、profile、账号、经验库、原始journal、含短期本机token的Host/ready日志及单次真实模型runner不随仓库或ZIP公开。
