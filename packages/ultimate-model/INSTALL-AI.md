# 给安装AI的说明

本目录是正式 DSH bundle，不是向home复制文件的脚本包。先读取 [package.json](package.json)、[cordis.patch.yml](cordis.patch.yml)、[README.md](README.md)与[manifest.json](manifest.json)，确认版本兼容和用户目标。

## 关于行名与“物化”

`cordis.patch.yml` 在归档中保留可移植表达式（发行物禁止携带作者物化路径）；导入前，必须物化 bundle 插件的**字面绝对路径**。原因：

- 宿主在求值前读取 `row.name` 做兼容预检（`dsh-app-boot` 的 `manifestOf` → `name.startsWith`）。**表达式型 name 会被判为无法校验并 `disabled`**，日志只有一行 `disabling profile plugin row ...`。
- `#./x` 不行：`#` 前缀是 Node package-imports，必须在消费方 profile 的 package.json 声明映射。
- 普通相对路径也不行：它会相对 **profile 目录**解析，不是包目录。

因此不存在既免绝对路径、又能通过预检的行名。本包选择导入前按实际目录物化。

### 换到别处安装时（路径不同）

字面路径是**本机专用**。把包放到别的位置后必须重新生成：

```bash
node materialize.mjs --check   # 只校验当前模板的解析、路径与资源，不写盘
node materialize.mjs --out=cordis.patch.yml   # 按新路径重写字面版
```

- `--out` 指向哪个文件就写哪个；不带 `--out` 默认写本包的 `cordis.patch.yml`；定制旁路文件应输出到包目录之外，以免进入严格分发清单。
- 参数只接受 --check、--out=<file>、--template=<file>；未知、重复或空值退出2且零写入。
- 所有本地资源（表达式或字面量）都检查包内归属及文件/目录类型；路径表达式只解析已分发格式，不执行额外 JavaScript。验证失败退出1，不进入写入阶段。
- 可移植源保存在 `cordis.patch.template.yml`（保留 `__jsExpr`，跨机器同一份）。

## 必须守住

- 系统/开发者及目标机用户规则优先。本包的个人风格不是授权，不覆盖目标机AGENTS/技能/其他模式/模型/凭据。
- 安装前列出bundle，避免重复；用官方plugin_manager install_bundle，target是本目录绝对路径。不要手写profile package/patch，不在profile目录运行包管理器。
- 不请求或传播口令，不自动装MCP、改endpoint/权限、修第三方源码、迁移软件/用户目录或停本实例。
- 查看installation.application、warnings、pendingBuilds。新代码未装载不能说已生效；待构建脚本须用户明确批准，不因包名可信自动放行。
- 新会话显式选择 Ultimate-Model（preset id: ultimate-model）；当前会话不强切。先验证预设登记/私有scope挂载、专属工具可用且standard不泄漏，再做实际任务验证。

## 自检与证据

先运行 `node scripts/prepare-install.mjs --check` 校验分发原像及资源，再运行 `node scripts/prepare-install.mjs` 物化本副本并自检。测试用SKILL_INDEX_TEST_TMPDIR显式指定home外临时目录，再运行 node scripts/selfcheck.mjs --tests；可用pwsh时另跑 tests/queue-scope.test.ps1。保存命令、退出码、通过/失败/跳过数。

真实宿主与新会话模型投影是不同层；静态通过、文件存在、mock通过不能替代实装。安装结果要求restart时，不在当前实例自己执行停止；报告边界并按用户授权交接。

## 能力与自我升级

规则/技能按需读取；jizhi_skill_search查包内元数据，命中后read真实SKILL.md。四项 Cordis library 薄路由通过当前 Host Inspect 的 Config packageDir 定位官方源；没有 Host 时明确返回未解析入口，不猜安装路径。正文、参考和模板按需读，管理工具激活不等于安装批准。jizhi_context/jizhi_experience 使用单个 request JSON字符串，严格内部动作不附无关键；旧会话 Schema 与新代码分开核验，不为恢复失败禁用或绕过守卫。个人/项目已有技能仍走宿主优先级，库检索不冒充全catalog。经验模块只写受限经验数据，来源、适用工作区、验证状态和改进候选分开；没有明确用户反馈不制造个人习惯。规则、技能代码、hooks与MCP变更候选先验证、依权限裁决，不自动放宽红线或修改凭据。

MCP参考默认不注册，沿用目标机可用连接；新增连接先核对schema、可执行路径、来源版本与权限，不能把示例占位符当真实服务。

## 本地上下文与升级边界

先读 [恢复指南](RESTORE.md)。jizhi_context 自动元数据不能替代模型里程碑save；跨会话恢复须显式选择且重新核对当前任务和文件。旧验证不算当前通过，取消不复活，不用历史偏好补造授权。个人经验/检查点数据不迁入目标机或共享包。没有公开等待式压缩前hook，不保证零损失。

本版提问配置使用已核对的 legacy 枚举，不杜撰 blocking。安装参数不要填写空 registry；没有用户指定时沿用管理器配置。若遇 EPERM，先只读诊断，不默认是ACL/占用，不反复安装或自行修权限/停止本实例。

## 意图澄清与提示词优化

请求含混/歧义或明确要求优化提示词时按需读取 [意图澄清](skills/core/intent-clarification/SKILL.md)。保留原意给改写/选项/建议并询问，事实先查；不把推荐、超时或代答当用户确认，更不当授权。明确请求不要重复问。它不劫持用户输入、不启动额外模型或MCP；静态文本测试不证明每次真实模型行为。

## 对话任务自测与分享完整性

需要任务自测时复用 [verify-before-claim](skills/core/verify-before-claim/SKILL.md) 的[自适应证据闭环](skills/core/verify-before-claim/references/task-selftest.md)，不机械跑满步骤，也不把检查器的记录一致性当作真实执行。分享版的 MCP、CLI、进程和连接能力均须在目标机现场发现，不沿用作者机器的历史状态。

先核对下载 ZIP 的 SHA256 侧车与原始解压内容清单，再按新位置物化路径并自检。物化器会更新对应路径文件及其清单哈希；这不是修改 profile 或安装 bundle。哈希只用于完整性核对，不是签名、可信构建来源、执行授权或真实宿主加载证明；需另按当前用户要求验收这些层。

## 回退

官方plugin_manager list_bundles后remove_bundle，使用确切安装标识。保留用户后改内容、旧模式与经验数据；旧卸载脚本--apply被拒绝，不能改回旧快照或递归删除。

最终汇报分开：已落地并验证 / 运行时待验证 / 未做。只有最终打包产物的文件清单与SHA256匹配，才把它交给用户。

执行包内入口前，应使用独立可信来源核对 ZIP SHA256；prepare-install 使用 Node 内置模块先读清单数据，校验全部文件后才调用其他包内脚本。它是完整性便利入口，不能认证自身、来源可信度或授权；不要执行未知归档代码来建立对同一归档的信任。
