# 来源与许可

本仓库的插件来源为用户提供的 Ultimate-Model 1.4.3-review.2，由原始 Jizhi / dsh-liangshen 内容衍生。原有来源声明位于包内。未为原始内容设定新的统一许可证；本仓库 Public 可见性不转移或扩张第三方权利。

Qoder-Optimization v0.0.30 方法适配来源：<https://github.com/liushikuan63/Qoder-Optimization>，本轮重新核验 main 为0100c5abd4eb25405a6c6dc2e6c095e2319fa5cd（规则5.7.0；VERSION仍为v0.0.30）。MIT 声明完整保留在包内 SOURCES.md。组件内SOURCES保留其构建时33386快照，0100c5为后续核验，不重写已冻结组件字节。当前分享工作流已覆盖其目标归属、分段检验、按需能力与并行归属原则，不照搬Qoder专有hook或权限规则。Codex 本地方法只按原则独立改写，未复制个人配置、记忆、凭据或客户端代码。

包内 js-yaml 沿 MIT 许可，见 [js-yaml 许可](packages/ultimate-model/vendor/LICENSE.js-yaml)。预设、分页来源见 [分页来源声明](packages/ultimate-model/preset/lib/NOTICE)。引用的官方 DSH、第三方插件与服务均不随本仓库重新许可，不暗示官方背书。

## billion-context 兼容修复 / Compatibility repair

本分享包的可选状态接口修复工具使用了已安装 `billion-context@0.1.212` 的响应头构造逻辑，原作者为 ranxianglei，来源：[billion-context](https://github.com/ranxianglei/billion-context)。完整第三方包及其 acp-kernel 未随此工具重新分发；用户没有安装该组件时无需安装或使用本修复工具。修复仅接受文档所列的精确已审前像，不将本机安装字节冒称为重新核验过的所有官方发行版本。

安装包的 LICENSE 包含 MIT 文本及额外的产品界面/文档出处标注条款；本仓库保留[完整原文](docs/third-party/billion-context.LICENSE.txt)，并在 README 与修复文档中提供可见出处。涉及 acp-kernel 的上游出处为 [acp-kernel](https://github.com/ranxianglei/acp-kernel)。这些许可不扩展为整个 Ultimate-Model 或本仓库的统一许可。

The optional status-endpoint compatibility utility adapts response-header logic from installed `billion-context@0.1.212`, by ranxianglei; source: [billion-context](https://github.com/ranxianglei/billion-context). The complete third-party package and acp-kernel are not redistributed by this utility. Users without that component do not need to install it for Ultimate-Model. The repair accepts only its documented, reviewed byte preimage; it is not a claim that every upstream build was independently reverified.

The installed LICENSE contains MIT text **and an additional product-surface/documentation attribution term**. Its [complete original text](docs/third-party/billion-context.LICENSE.txt) is retained, with visible attribution in the README and runtime guide. The upstream kernel attribution, where applicable, is [acp-kernel](https://github.com/ranxianglei/acp-kernel). These terms do not relicense the whole repository or Ultimate-Model.

## DSH NEXT 页脚布局兼容修复 / Footer layout compatibility repair

可选页脚工具基于本机 `dsh-desktop-next@2.0.20-next` 客户端的特定已审字节，修正 content-box 宽度口径及局部 ResizeObserver 布局调度。发行元数据声明 MIT，指向 anywhere-labs 的桌面仓库；该地址当前跳转到 [dsh-desktop](https://github.com/anywhere-labs/dsh-desktop)。保留源码仓库的 [MIT 许可](docs/third-party/dsh-desktop.LICENSE.txt)（Copyright 2026 Anywhere Labs）。分享包不分发完整 ASAR、EXE、unpacked 文件或 Electron/Chromium 依赖，原安装的依赖许可仍适用；这不将整个 UM/分享包重新许可。

The optional footer utility targets reviewed bytes from installed `dsh-desktop-next@2.0.20-next`, correcting content-box width handling and local ResizeObserver layout scheduling. Its distribution metadata declares MIT and names the anywhere-labs desktop repository, now redirected to [dsh-desktop](https://github.com/anywhere-labs/dsh-desktop). The source repository's [MIT notice](docs/third-party/dsh-desktop.LICENSE.txt), Copyright 2026 Anywhere Labs, is retained. The full ASAR, executable, unpacked files and Electron/Chromium dependencies are not redistributed; their installed notices remain applicable. This does not relicense the complete UM/share pack.

ASAR 载体只按公开文件格式处理数据；私有验收使用既有官方 [@electron/asar 3.4.1](https://github.com/electron/asar/tree/v3.4.1) 读回，与 [Electron 完整性文档](https://github.com/electron/electron/blob/v44.4.5/docs/tutorial/asar-integrity.md) 对照。工具不分发该 npm 库，不修改 EXE、fuse 或完整性开关。

The carrier treats ASAR as data using its public format. Private acceptance reads the result with the existing official [@electron/asar 3.4.1](https://github.com/electron/asar/tree/v3.4.1) and checks the [Electron integrity contract](https://github.com/electron/electron/blob/v44.4.5/docs/tutorial/asar-integrity.md). The npm library is not redistributed; the utility does not modify the executable, fuses or integrity settings.


## DSH 核心输入栏与账号响应分类 / Core input bar and account-response classification

新增可选修复器中的局部输入栏调度及账号403日志分类，基于已审 `@deepseek-ai/dsh-client-ui-conversation` 和 `@deepseek-ai/dsh-deepseek-account-platform` 的指定字节。兼容CLI包元数据为core0.2.1-rc.3，许可MIT，来源指向[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)；版权为Copyright (c) 2026 DeepSeek，完整[原许可](docs/third-party/dsh-harness.LICENSE.txt)保留。工具只分发精确前像限制的局部变换，不分发完整应用模块、ASAR、EXE、用户配置或账号数据。原安装依赖及其许可保持适用，不能据此推断不同构建字节或新版SDK已经验收。

The optional focused input-bar scheduling and account403 log classification adapt reviewed byte preimages from `@deepseek-ai/dsh-client-ui-conversation` and `@deepseek-ai/dsh-deepseek-account-platform`. Compatible CLI package metadata identifies core0.2.1-rc.3, MIT, and the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) source repository. Copyright (c) 2026 DeepSeek and the [complete installed license](docs/third-party/dsh-harness.LICENSE.txt) are retained. Only narrowly pinned transforms are distributed, without complete application modules, archives, executables, user configuration or account data. Installed dependency notices remain applicable; this is not acceptance of another build or newer SDK.

## Cordis 依赖所有权兼容修复 / Cordis dependency ownership compatibility repair

`scripts/lib/dsh-cordis-ownership-source.cjs` 对精确已审的 `@deepseek-ai/cordis@4.0.5` 提供六个局部替换，参考官方 [a91a827](https://github.com/deepseek-ai/deepseek-harness/commit/a91a827546727057a4e0d05b7fa59ff5c5138be1) 的实际消费者所有权思想，并保留旧 SDK 所需的并行清理和取消顺序。它不是整体移植 Cordis4.1 或升级 DSH SDK。原包版权为 **Copyright (c) 2021-present Shigma**、MIT；[完整原许可](docs/third-party/cordis.LICENSE.txt)与已安装ASAR中的许可逐字一致，亦与[固定官方vendor版本](https://github.com/deepseek-ai/deepseek-harness/blob/ddefc45fbc7f8e46dd73185e68295696d1297887/vendor/cordis/LICENSE)相同。DeepSeek的MIT声明与Cordis原作者声明分别保留，不相互替代。工具只分发受固定前像和后像限制的局部变换，完整原模块和应用归档不分发。

`scripts/lib/dsh-cordis-ownership-source.cjs` supplies six focused replacements for exact reviewed `@deepseek-ai/cordis@4.0.5` bytes, adapting the committed-consumer ownership concept from official [a91a827](https://github.com/deepseek-ai/deepseek-harness/commit/a91a827546727057a4e0d05b7fa59ff5c5138be1) while preserving the parallel cleanup and cancellation order required by the old SDK. This is not a wholesale Cordis4.1 transplant or DSH SDK upgrade. The original package is **Copyright (c) 2021-present Shigma**, MIT. Its [complete license](docs/third-party/cordis.LICENSE.txt) exactly matches the installed ASAR and the [fixed official vendor version](https://github.com/deepseek-ai/deepseek-harness/blob/ddefc45fbc7f8e46dd73185e68295696d1297887/vendor/cordis/LICENSE). DeepSeek and original Cordis notices are retained separately. Only tightly pinned transformations are distributed, without the complete compiled module or application archive.


## Standing subagent lifecycle / 子作用域生命周期

`scripts/lib/dsh-subagent-ownership-source.cjs` 为精确SDK0.2.1-rc.3提供六个局部、双向固定哈希替换，修复组合插件未释放自己安装的agent子fiber。来源为DeepSeek Harness的MIT代码，完整声明见[原许可](docs/third-party/dsh-harness.LICENSE.txt)。不分发完整提取模块，不隐藏重复工具或清理失败。

The helper provides six focused bidirectionally hash-pinned edits for exact SDK0.2.1-rc.3 bytes, repairing composition-owned agent child-fiber cleanup. Source is DeepSeek Harness MIT code; the [complete license](docs/third-party/dsh-harness.LICENSE.txt) is retained. Complete extracted modules are excluded; duplicate tools and cleanup failures remain visible.
