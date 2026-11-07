# 来源与许可

本仓库的插件来源为用户提供的 Ultimate-Model 1.4.3-review.2，由原始 Jizhi / dsh-liangshen 内容衍生。原有来源声明位于包内。未为原始内容设定新的统一许可证；本仓库 Public 可见性不转移或扩张第三方权利。

Qoder-Optimization v0.0.30 方法适配来源：<https://github.com/liushikuan63/Qoder-Optimization>，已核验 main 为33386f97bba86a852d90c9ade14222024d91adaa。MIT 声明完整保留在包内 SOURCES.md。Codex 本地方法只按原则独立改写，未复制个人配置、记忆、凭据或客户端代码。

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
