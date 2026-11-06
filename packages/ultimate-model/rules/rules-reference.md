# Ultimate Model维护入口

本包只注册显式选择的 Ultimate-Model 预设（`ultimate-model`），不覆盖用户级规则、凭据、其他预设或任务。

- 规则：AGENTS.md；待使用时读，不把所有技能正文常驻。
- 能力与验收：README.md 与 tests/；实际装载以宿主预设名册及新会话工具投影为准。
- hooks/ 是可选源码与隔离测试资料，默认不注册旧进程桥；不能把文件存在当已运行。
- plugins/ 是受测源码；守卫按预设作用域注册；超时自动选择默认不启用，审批意图永久禁止自动选择。
- 历史项目的私有适配不随分享包传播；目标机先按当前项目识别技术栈/端口。

## profile 插件安装失败根因与正确流程

先使用官方 `plugin_manager` 的安装、列表与卸载接口，并读取实际 application、warnings 和 pendingBuilds。历史 Windows / DSH 0.2.1-rc.3 / pnpm 12.9.1 的失败记录是诊断线索，不代表所有 install_bundle 必然失败。

- EPERM 先确定失败对象和阶段：短暂文件发布、ACL、杀毒扫描、native 模块占用、包管理器重排各有不同处理。仅对自有、同身份、同哈希的短暂发布执行有界重试；不改权限、不反复跑安装，也不用改名正在运行的目录来试锁。
- `.dll`、`.node`、`bash.exe` 可能被进程持有。需要停机维护时先备份、核验用户当前授权与活跃任务，不能自行终止实例。当前 shell 中更新自身运行目录应避免。
- `--no-optional` 会省略可选依赖，可能使 CUA 等功能不完整；不作为统一安装方案。手动写 profile 或执行包管理器仅能用于另经审查、限定范围、可回退的维护流程。
- 先核对磁盘清单与实际加载代次，再按能力选择验证：插件/预设注册、工具投影、命令或 UI 挂载，最后实际调用关键路径。Tool.listTools 适用于工具，不能单独验收纯 UI、观察器、模型适配器或其他无工具插件。
- 检查 Home → profile → bundle 的组合关系。同 id 的后层行可能覆盖新 bundle，list_bundles 并不能证明没有 Home 遗留。保留用户自定义配置，仅迁移已证实归属的旧受管行；卸载演练也要检查组合后是否还有独立注册。
- 是否热加载由当前 `patchReload` 与宿主行为决定。`startup` 模式下，文件更新不表示本代进程已加载；待重启必须记为待验。
- 第三方 shell 的 replacePwsh、压缩插件和自动续跑可能影响其他模式；先检查实际行 id、版本和作用域，避免重复拦截、重复压缩或取消后被再次唤醒。

## billion-context 使用要点

它**自动工作**，不需要日常手动操作；手动 `compress` 多数情况是空操作。

### 三个入口

1. Web UI：插件自选端口，地址形如 `http://127.0.0.1:<port>/__bili/`
   （`acp_cache` 会返回带会话 id 的完整地址）。可看上下文构成、压缩块、
   缓存命中与每次请求的账。
2. 配置文件：`~/.config/billion-context/billion-context.json`
   （`$XDG_CONFIG_HOME/billion-context/`；`BILI_CONFIG_FILE` 可改路径）。
   覆盖压缩阈值、上游代理、provider 路由、会话 GC 等。
3. 会话内工具：

| 工具 | 用途 | 何时用 |
| --- | --- | --- |
| `acp_status` | 上下文构成、可压缩区间、nudge 状态 | 查当前占用与可压范围 |
| `acp_cache` | 缓存命中账与未命中归因 | 怀疑缓存没打中、成本异常 |
| `compress` | 手动折叠指定区间 | 少见；阈值未到时是 no-op |
| `decompress` | 还原压缩块 | 需要某段原文细节 |
| `search_context` | 在被压掉的块里检索 | 先搜再决定是否还原 |
| `cache_warmup_result` | 读回被预览截断的大结果 | 输出带 `ref://` 句柄时 |
| `acp_read_original_image` | 读原分辨率图 | 看小字、像素对齐 |

### 判据

- **不要靠手动 `compress` 判断它是否在工作**。日志里会出现
  `compress requested ...` 紧接 `compress no-op ... → 0 blocks`，
  那是阈值未到（`growth < floor`）时的正常表现。
- `acp_status` 显示 `0 summaries` / `No compressed blocks` 不代表插件失效。
- 是否真压缩看 `acp_status` 的 `COMPRESSED BLOCKS` 与 nudge 状态变化。

### 缓存注意

`PCK SELF-STAMPING OFF BY DEFAULT`：它不再自行添加 OpenAI 的 `prompt_cache_key`。
若上游是中转/号池（按前缀缓存路由），**前缀缓存可能随机打不中**，需开回来：

```json
{ "promptCache": { "routing": "auto" } }
```

直连官方 API 可忽略。

### 视觉类插件的共性缺口

`dsh-vision-router` 一类视觉插件装载成功、日志持续写入 `plugin=<version>`，
但 `live model discovery failed`（各 provider `fetch failed` 或 403）
属于**缺少视觉 provider 凭据**，不是安装失败。要用图片识别须先在设置里
配置可用的视觉模型；不要把「已装载」当作「可用」。

## 推荐插件与来源

以下来源均取自本机已安装包的 `package.json`（`repository` / `homepage` 字段），
非人工拼写。**版本号为 2026-11-06 实测值**，目标机安装前应自行核对最新版与
`engines.dsh` 兼容区间；本表不构成对上游项目安全性、许可或长期维护的背书。

安装优先使用官方 bundle 管理器，核对实际依赖完整性和目标机兼容性
（原因见上一章）；下表「注意」列标出该包特有的前置条件。

### 文档与内容生成

| 插件 | npm 包名 | 实测版本 | 来源 | 注意 |
| --- | --- | --- | --- | --- |
| 演示文稿生成 | `dsh-ppt` | 0.20.5 | <https://github.com/STARDUSTLC666/dsh-ppt> | 要求 `engines.dsh >=0.2.1-rc.3`；装后 8 个工具（`ppt_create`/`ppt_edit`/`ppt_render`/`ppt_check` 等），技能同步注册。产物为 HTML + PPTX + JSON 三件套，交付前须实际打开检查 |
| 上下文压缩 | `billion-context` | 0.1.212 | <https://github.com/ranxianglei/billion-context> | 自动工作，手动 `compress` 多为 no-op；详细用法见上一章。会接管 compact 相关行，卸载须整包从 `bundles` 移除 |

### 模型与视觉能力

| 插件 | npm 包名 | 实测版本 | 来源 | 注意 |
| --- | --- | --- | --- | --- |
| 视觉路由 | `dsh-vision-router` | 3.1.3 | <https://github.com/ysr666/dsh-vision-router> | 装完仍需配视觉 provider 凭据，否则 `live model discovery failed`；`sharp` 是可选的 peer，缺失时部分本地处理降级 |
| 图片读取桥 | `@liustack/modlens` | 3.27.2 | <https://github.com/liustack/modlens> | 提供 `modlens_read_image`；需单独配置引擎，`npx @liustack/modlens doctor` 可自检 |
| ChatGPT 订阅接入 | `@eddyskywalker/dsh-chatgpt-subscription` | 0.57.0 | <https://github.com/Aa728848/dsh-chatgpt-subscription> | 走 ChatGPT 订阅额度；本机 profile 对它有 pnpm patch，升级时留意 `patchedDependencies` |
| TRAE 额度接入 | `trae2api-dsh` | 1.3.1 | <https://github.com/FuSheng-cs/Trae2api-dsh> | 从 GitHub Releases 安装 tgz；同样存在 pnpm patch，升级需同步 |

### 上下文与交互体验

| 插件 | npm 包名 | 实测版本 | 来源 | 注意 |
| --- | --- | --- | --- | --- |
| 上下文面板 | `dsh-context` | 0.78.1 | <https://github.com/bowenliang123/dsh-context> | 提供上下文构成看板与 `context` 命令；与 `billion-context` 功能有重叠，建议只启用一个压缩/观测主入口 |
| 生成式 UI | `dsh-genui` | 0.3.1 | <https://github.com/lhuans/dsh-genui> | 会话内渲染图表、表单、卡片；与宿主内置卡片能力并存时注意样式与提示词占用 |
| 侧边栏增强 | `dsh-better-sidebar` | 0.28.2 | <https://github.com/omdsh-dev/DSH-better-sidebar> | 文件树、编辑器、变更、任务合一；对外提供 tab 注册服务，其他插件可能依赖它 |
| 浏览器自动化 | `dsh-browser` | 0.1.0 | <https://github.com/ben7am1n/dsh-browser> | 依赖 Playwright Chromium，未装时用 `browser_install` 安装；与 MCP Playwright 同时启用易冲突 |
| Web UI 全家桶 | `@linxin666/dsh-web-all` | 0.4.12 | <https://github.com/zhu1090093659/dsh-web> | 聚合 25+ 前端插件（任务板、皮肤、远程 UI 等）。**它内含 `@linxin666/dsh-win-bash`，后者默认 `replacePwsh: true` 会撤下宿主 `pwsh`**，要双通道按上一章改 patch |

### 协作与运维

| 插件 | npm 包名 | 实测版本 | 来源 | 注意 |
| --- | --- | --- | --- | --- |
| 多代理协作 | `@nanmicoder/dsh-agent-teams` | 0.1.27 | <https://github.com/NanmiCoder/dsh-agent-teams> | 提供队长/成员/任务 DAG；与宿主内置 AgentTeams 能力重叠时只留一套 |
| 插件市场 | `dsh-plugin` | 1.5.0 | <https://github.com/dshplugin/dsh-plugin-hub> | 应用内浏览安装社区插件 |
| 插件市场（另一实现） | `dshmarket` | 1.73.3 | <https://github.com/dsh-market/dsh-market> | 与上一条同域，**不要同时启用两个市场** |
| 运维工具集 | `dsh-ops` | 0.4.4 | <https://github.com/T-Auto/dsh-ops> | 提供 shell/file/background/ptc 原生工具；**不是包管理器**，不能替代 pnpm 装插件 |

### 选型提醒

- **同域只留一个**：两个插件市场（`dsh-plugin` / `dshmarket`）、两套上下文观测
  （`dsh-context` / `billion-context` 的观测面）、两套子代理实现，同时启用会重复占工具面与提示词。
- **装前先看 `engines.dsh`**：本表版本基于 `0.2.1-rc.3`，跨大版本时以目标机宿主版本为准。
- **含 native 或可选依赖的包**（`@trycua/*` 一类）在宿主运行中无法重装，
  必须用 `--no-optional` 或停机后安装，详见上一章。
