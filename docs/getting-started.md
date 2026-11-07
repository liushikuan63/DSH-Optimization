# 首次安装与检查

[English](en/getting-started.md) | 简体中文

推荐先用完整分享包，安装插件后再按需选择通用工作规则。本指南仅使用本包实际提供的入口，不安装DSH本体、模型账号、MCP或Qoder组件。

## 1. 选包、校验和放置

从[本版Release](https://github.com/liushikuan63/DSH-Optimization/releases/tag/v0.1.4)下载 `DSH-Optimization-0.1.4.zip` 和同名 `.zip.sha256`。只需要预设的用户可选独立 `Ultimate-Model-1.4.3-review.7.zip`；独立包没有根目录的通用工作规则安装器和本指南，安装步骤沿用包内README/INSTALL-AI。

Windows PowerShell可在下载目录执行：

```powershell
Get-FileHash -LiteralPath '.\DSH-Optimization-0.1.4.zip' -Algorithm SHA256
Get-Content -LiteralPath '.\DSH-Optimization-0.1.4.zip.sha256'
node --version
```

比较64位十六进制哈希，大小写不影响结果；不一致就停止安装。校验文件证明下载一致性，下载来源与入口脚本自身仍须可信。Node最低22；本轮实测24。不需要克隆仓库或安装额外依赖来运行prepare/工作规则安装器。

把完整包解压到自己的长期目录，可以是任意可写本地盘，路径有空格时加引号。不要直接覆盖旧安装目录。结构应为：

```text
DSH-Optimization-0.1.4/
  README.md
  VERSION
  docs/                         # 本指南、使用、恢复、验收及历史
  overlays/                     # 可选全局规则与说明
  scripts/install-workflow.mjs   # 只读预演 / 显式应用
  scripts/build-release.py       # 维护者构建，不是安装入口
  packages/ultimate-model/       # 交给DSH官方管理器的完整插件目录
    INSTALL-AI.md
    FILES.sha256
    cordis.patch.template.yml
    scripts/prepare-install.mjs
```

这份本地目录安装在本轮SDK中实际采用link，管理器会继续使用传入目录。请先确定最终路径，安装后保留它；改位置后要重新准备并检查实际绑定路径。

## 2. 准备插件

进入刚解压的完整包根目录。以下示例中的占位路径需替换为自己的实际绝对路径：

```powershell
Set-Location -LiteralPath '<完整包根目录的绝对路径>'
Set-Location -LiteralPath '.\packages\ultimate-model'
node scripts/prepare-install.mjs --check
node scripts/prepare-install.mjs
node scripts/selfcheck.mjs
```

独立插件ZIP解压后直接进入 `ultimate-model` 目录，再执行后三条命令。每条都应退出0；`--check`只读验证完整性和资源，第二条只在当前插件副本生成字面绝对路径与配套清单，不修改DSH profile，第三条为静态自检。物化后的patch与清单发生预期变化，不再直接等于分发源字节；不要将这种变化当成原ZIP损坏。

## 3. 用DSH官方管理器安装

可把下面任务交给DSH，并替换插件目录路径：

> 请读取 `<插件目录绝对路径>/INSTALL-AI.md`。先检查当前core版本、已安装bundle、Home/profile同id覆盖、本地定制和停用项；只在上述目录运行本包prepare并用官方plugin_manager.install_bundle安装该目录，不覆盖个人Home、账号、模型、MCP、其他bundle或经验数据。有影响正确性/恢复/授权的冲突先列明处理方案；正常可逆准备继续执行。根据application、warnings、pendingBuilds说明是否已采用，需重启时先确认当前任务可中断。完成后自检并读回实际预设与工具，未执行项按未验报告。

工具名按宿主实际目录发现，不能只凭本文拼出不存在的API。官方安装结果可能是restart-required/no-hmr；文件已写、列表有记录或测试通过，都不单独证明现役进程已重新加载。

在已安排的维护窗口正常重启后，绑定目标工作区，再显式选择 **Ultimate-Model**。不会强制切换旧会话的默认模式。浮层存在时先正常完成官方预览说明和Vision Router引导，具体见[部署排障](deployment.md)。

## 4. 可选：把通用工作规则用于各模式

需要各模式采用目标、分段验收、VibeCoding、文件归属等通用规则时，在**完整包根目录**执行。`--home`必须是自己目标DSH已有Home的绝对路径，不要照抄他人机器路径：

```powershell
node scripts/install-workflow.mjs --home '<DSH_HOME绝对路径>'
node scripts/install-workflow.mjs --home '<DSH_HOME绝对路径>' --apply
node scripts/install-workflow.mjs --home '<DSH_HOME绝对路径>'
```

先看第一条只读计划；只有计划和目标正确才执行第二条。首次追加的动作是APPEND，完整原文先备份；第三条应为KEEP。若已有不同/定制受管区块，REVIEW_UPDATE退出3且不写入，需比较后人工合并；不要删块或强制覆盖来绕过检查。它只维护AGENTS受管区块，不修改默认预设、模型、账号或hook注册。完整行为与退出码见[规则安装器说明](../overlays/README.md)。

## 5. 首次使用的完成检查

| 检查 | 怎样算通过 |
| --- | --- |
| 分发来源与字节 | 可信Release取得、ZIP哈希与对应侧车一致 |
| 插件副本 | prepare与selfcheck退出0，实际资源路径存在 |
| 宿主采用 | 官方结果无未处理错误，按需重启后当前会话确实选择Ultimate-Model |
| 原有配置 | 本地定制、停用项、账号、模型、其他bundle及个人数据保留 |
| 可选工作规则 | 安装前后备份/原字节核对，最终只读计划KEEP；新任务规则采用另验 |
| 真实小任务 | 在自己的新建工作区实际读/写/测试并核对产物及保护文件，不能只看模型自述 |

真实模型任务会使用现有账号额度。先用[使用指南](usage.md)里的受控小任务确认自己的客户端路径；本仓库的本机验收只覆盖其记录的机器、版本和任务。

升级、卸载和回退请读[部署与恢复](deployment.md)。通过官方remove_bundle卸载插件，不删除个人经验/检查点；回退先比较当前新增内容，再用备份恢复相应改动，不整份覆盖后来的用户更新。


Bili状态轮询CORS修复是完整包中的显式可选工具，先看[运行修复与回退](runtime-repairs.md)。不会随UM安装自动修改其他插件。
