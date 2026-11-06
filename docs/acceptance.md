# 验收报告：0.1.0 / Ultimate-Model 1.4.3-review.6

验收日期：2026-11-07（Asia/Shanghai）。实现和本机部署由主集成者负责；最终插件 ZIP 由独立验收者重新解包、安装副本并运行 SDK/UI，官方管理器另由独立验收者验证。所有测试都在同一台用户 Windows x64 机器上；“独立”指职责、解压目录与 Home/profile 隔离，不代表另一台机器。

[机器可读脱敏摘要](evidence/acceptance-summary.json)与本报告使用相同分层；未运行的真实模型专项明确标为 PREREQ，不纳入通过计数。

## 已冻结的插件字节

- 文件：`Ultimate-Model-1.4.3-review.6.zip`，705119 字节，215 个归档成员。
- SHA256：`9938562f6691e67a35c40fe83b37cf5d496c4953ee388e4e8a882396ca4266ab`。
- 精确清单：214 个被校验文件，另有 `FILES.sha256` 自身；归档 CRC、安全路径、大小写冲突、链接与清单集合均通过。
- 插件结构：55 个技能，25 个组合插件行。原始输入 1.4.3-review.2 的 SHA256 为 `730c69584c7cd57a953782533459d00503c00e40a2a661414125a1a374110b67`；原件保留。
- 完整分享 ZIP 另含可选全局规则、安装器及本报告；其最终 SHA256 由同名 `.zip.sha256` 和发行页给出。本报告不嵌入包含自身的 ZIP 哈希。

## 通过的验证层

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

**PREREQ / 未执行：真实主模型请求0次，不能判为通过。** 已准备自有隔离工作区、三个指定产物、保护文件和独立验收器；用户已批准当前账号模型、最多6次主请求/300秒。现役入口在发送前因路由标识检查拒绝，未创建真实任务，也未消费这项模型预算；该失败属于私有验收辅助的旧路由假设，不是插件验收通过或真实Provider失败的证据。

随后发现本机既有订阅适配器可在一次SDK主请求内进行账号轮换、输出预算恢复并直接重发HTTP；离线执行实际版本的纯恢复函数，严格复现“SDK gate计数1、生成fetch计数2”。公开的 llm/stream 门可以限制SDK主请求数和300秒，找不到逐次provider发送前的会话预算入口，因此不能承诺内部HTTP生成请求也不超过6次。没有修改订阅插件、账号、默认路由或全局fetch来绕过。

这项额外重发/额度边界仍待用户裁定；未获扩展授权前保持0请求。临时验收row已经移除，DSH正常重启恢复。离线fixture的工具、测试与完成链均真实执行，但不证明当前真实Provider能完成本任务；后续若另获适用授权实测，需单独更新回执与本段，不能把此PREREQ当PASS。

本机恢复后记录三个启动健康事件，另有一条既有 `[deepseek-account] account read failed` renderer日志；同类记录早于本次review.6部署。没有读取或修写该账号凭据，也不将“宿主已ready”解释为该账号或全部控制台已无错误。当前任务路由、该独立账号插件与包回归证据分别看待。

## 修复依据与失败保留

- review.3 虽通过303个测试，独立真实SDK发现预设私有 native CUA 注册依赖缺失，导致整个预设 broken。去掉第二个 provider 后，最终 review.6 重新从冻结 ZIP 完整验收；未把旧成功当新证据。
- 多文件索引、层级状态、物化 patch 与清单改用同一输入快照、对象身份/哈希预像和可恢复发布；准确并发时点的首红保留。短暂 EPERM/EBUSY/EACCES 有限等待并反复核对归属，提交成功后的清理失败与提交失败分开。
- 安装便利入口先用 Node 内置模块校验清单，再执行包内脚本；外部下载来源与入口自身仍需要独立信任，清单不能自证来源。
- 明确“不落盘”同时约束自动行为和显式持久工具；不把引用、工具结果或继承历史当用户新授权。
- 官方安装探针第一次卸载误给 pnpm remove 传命令专属 flags，被拒绝。改为通用 `--config.*` 离线/禁脚本配置后完成同一profile卸载，未重复安装、未放宽边界；该失败属于探针，原日志保留。
- 模式拦截来自合法模态，正常确认/关闭后验证；Vision Router“稍后”只管本页，与持久已读不同。没有 force 点击、移除 inert 或关闭视觉功能。

## 兼容与未验范围

本轮工具链包括 Node24（包声明最低Node22），DSH core0.2.1-rc.3、Playwright Core1.61.1、系统Chrome及pnpm11.7.0 JS发行版。包的声明范围为core >=0.2.1-rc.2 <0.3.0；未逐个版本验证，也未验Windows ARM、macOS、Linux、UNC路径、file/tgz/registry复制安装与Desktop默认native pnpm的全部锁定场景。

索引关键词只召回候选，当前模型做 USE/SKIP/ASK/NEEDS_FACTS 语义判断；这属于工作契约与现有工具使用方法，不是新的强制分类器。VibeCoding文档、提示词优化和并行归属已适配到已有技能，没有引入另一套常驻模型、SQLite governor、压缩器或 native driver。

311项回归包含注入的失败/并发反例，不能证明所有机器的间歇性EPERM永远消失；真实部署与受控任务提供本机当前证据。有限形式的递归删除/凭据/读取守卫不能覆盖任意脚本、间接调用和逻辑错误。工作规则改善行为，不承诺模型永不提前结束、误判或改错。

未执行跨平台矩阵、真实业务项目长任务、任意多代理并发写、远程数据库/支付/生产环境、额外付费服务、CI及所有第三方插件组合测试。未验项不计通过。个人Home、profile、账号、经验库、原始journal、含短期本机token的Host/ready日志及单次真实模型runner不随仓库或ZIP公开。
