# 来源与依赖说明

本技能于 2026-11-06 为 DSH 分享部署审查独立编写，用于补齐包内规则已经点名、却没有分发的 `local-skill-quality` 入口。它是模型按需读取的流程指引，没有新增自动安装器、后台监听或宿主事件实现。

## 提炼来源

- Qoder-Optimization：仓库 `https://github.com/liushikuan63/Qoder-Optimization`，本次只读核对 HEAD `4549f83798b8a0cc3e87e36b0138458892b6bfe7`，VERSION `v0.0.28`。参考该仓库 scripts 目录中 `capability-advisor.cjs` 的当前选择/已装状态/可信旧版本区分，`install-package.cjs` 的所选能力依赖闭包与本地差异阻塞，`package-dependencies.cjs` 的能力到运行脚本映射。这里记录的是外部源码位置，不是本技能的安装依赖；只提炼不变量，未复制它的事件 API、安装器代码或技能正文。
- 用户现有 Codex 个人技能：参考 `local-skill-quality`、`local-development-delivery` 的方法范围，包括保留定制、元数据与正文分开、文件存在与真实调用分开。没有核实可覆盖该个人技能集合的统一分发许可；本技能未复制其正文、Python 检查器、私有历史记录或 Codex 专有机制。
- 本 DSH 包现有入口：复用 `skill-router`、`verify-before-claim`、`long-task-discipline` 以及 scripts 目录中的 `skill-load.mjs`、`build-skills-index.mjs`、`audit-skill-runtime-deps.mjs`。这些入口的当前实际文件与执行结果仍需接收端核验；此说明不授予停用、覆盖或安装权限。

Qoder 的仓库 LICENSE 为 MIT，copyright (c) 2026 liushikuan63。若后续改为复制其代码或实质正文，应随复制部分保留对应版权和完整许可文本；本次方法提炼不替其他分发文件确定许可，也不将 Codex 个人技能或原 DSH 全包标为 MIT。

## DSH 适配边界

发现与载入沿当前 DSH 工具及已有脚本，不假设 Qoder 的事件输入可在 DSH 使用。当前本机核对的 hooks bridge 为 `@deepseek-ai/dsh-hooks-claude-code` `0.2.1-rc.3`：在 `agent/pre-step` 产生 `UserPromptSubmit`，并可将 `additionalContext` 合入下游消息。此处仅说明已核对的源码契约；本技能没有修改该 bridge 或证明它已在某个运行实例中触发。

脚本参数中的 home 必须从当前目标宿主确认，不继承打包者路径。`audit-skill-runtime-deps.mjs` 的覆盖取决于实际分发版本：只解析正文 scripts 引用的版本不能证明技能名称依赖、代码块命令、递归模块或外部运行包完整。静态审计、人工情景判断、测试替身和真实宿主验收应分别记录。

本技能不实现 checkpoint 或会话轮转；若任务涉及恢复，使用当前所选预设实际提供的现有检查点/队列入口，保留取消和停止状态。外部资料、历史检查点或自动提示均不能新增当前授权。
