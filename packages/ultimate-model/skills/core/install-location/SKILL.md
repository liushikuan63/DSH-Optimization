---
name: install-location
description: 本机新装软件一律落 D 盘，不占 C 盘。含目录约定（应用→D:\Program Files，命令行/开发工具→D:\Software）、winget / zip / npm / pip 各安装方式的实测做法、必须留在 C 盘的例外清单、装完核对真实路径的判据，以及迁移存量软件时容易踩的路径与防火墙坑。当需要下载或安装新软件、工具、运行时、服务端程序，或发现 C 盘空间异常增长、想把已装软件迁到 D 盘时加载。
whenToUse: 任何「装软件 / 下载工具 / 安装依赖 / 配运行时」的任务，以及清理或迁移 C 盘空间时。
---

# 新软件安装位置：本机一律 D 盘

> 常驻规则只有一行（`~/.dsh/AGENTS.md` §八「新软件装 D 盘，不落 C 盘」），细节与判据只在本文件。
> 改动本文件时 §二 表格与 AGENTS.md 那一行要一起改。

## 一、为什么（2026-10-04 实测底数）

C: 剩 **95.7 GB**（系统盘，紧张）｜D: 剩 **1327.9 GB**｜E: 剩 3741.4 GB（模型库 `E:\ollama-models`）。
D 盘已形成既有布局，本规则顺着它走，不新造目录体系。

## 二、目录约定（两类，别混用）

| 软件形态 | 目标目录 | 本机现有邻居 |
|---|---|---|
| GUI 应用、桌面软件、IDE | `D:\Program Files\<AppName>` | 7-Zip、JetBrains、Qoder、Steam++、Tencent、DSH Desktop |
| 命令行工具、开发工具、服务端程序、便携版 | `D:\Software\<tool>` | ffmpeg、nvm、db-cli、`_dl`（下载暂存） |

下载包先落 `D:\Software\_dl`，装完可删。

## 三、实测做法（按可控性排序）

**1. zip / 免安装版 —— 首选，完全可控**

```powershell
$tmp = "$env:TEMP\dl"; New-Item -ItemType Directory -Path $tmp -Force | Out-Null
& curl.exe -sSL --max-time 120 -o "$tmp\pkg.zip" 'https://.../pkg-1.2.3.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem   # 可选：先验条目数与顶层目录名
Expand-Archive "$tmp\pkg.zip" "$tmp\x" -Force
Move-Item "$tmp\x\pkg-1.2.3" 'D:\Program Files\pkg' -Force   # 注意 zip 内通常带版本号层
```

正例：nginx 1.31.6 官方 zip → `D:\Program Files\nginx`（36 文件 + 17 目录，`nginx -t` 通过）。

**2. winget —— 先查能否指定目录，不能就换 zip**

```powershell
winget show --id <id>                                     # 看 InstallerType / 是否支持 --location
winget install --id <id> --location 'D:\Program Files\x'   # 仅当支持时
```

❌ `winget install nginx` —— 本机实测 winget **无此包**（`No package found matching input criteria`），硬转会落 `C:\Program Files`。
正解：`https://nginx.org/download/nginx-<ver>.zip`。（`winget search nginx` 只有 F5 商业版 `nginxinc.nginx`。）

**3. npm 全局**：`npm config set prefix 'D:\Software\node-global'`
**4. pip 用户级**：`[Environment]::SetEnvironmentVariable('PYTHONUSERBASE','D:\Software\python-user','User')`

## 四、必须留在 C 盘的例外（别硬搬）

Windows 系统组件 / 驱动 / Store(UWP) 应用；注册表或安装器**硬编码 `C:\`** 的软件（硬搬会导致更新失败、快捷方式失效）；
用户配置目录本身（`%APPDATA%`、`%LOCALAPPDATA%`）——那是数据不是程序；pagefile / 临时目录；明确要求系统盘的软件。

遇到这类：**在汇报里写明「该软件只能装 C 盘，原因是 X」**，不要为合规硬搬；**已装且可用的一律不回头迁移**（存量不追溯），汇报里记一行即可。

## 五、判据（装完必做，必须能失败）

```powershell
# 注册表型安装器：读真实 InstallLocation
Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' |
  Where-Object DisplayName -like '*<名字>*' | Select-Object DisplayName, InstallLocation
# 便携版无注册表项时直接对照两个路径
Test-Path 'C:\Program Files\<名>'; Test-Path 'D:\Program Files\<名>'
```

判据写法：**期望 D 盘、实际读到 C 盘就是红**。只看到「装好了」不算证据。

## 六、正误示例

| ❌ 错 | ✅ 对 |
|---|---|
| `winget install nginx` → 落 `C:\Program Files` | 下载官方 zip → `D:\Program Files\nginx` |
| `npm i -g x` → 落 `%APPDATA%\npm` | 先 `npm config set prefix D:\Software\node-global` |
| 装完只说「已安装」 | 贴出 `InstallLocation` 的真实读数 |
| 存量软件在 C 盘就顺手搬 | 存量不追溯；只对新装的生效，搬迁另说且要备份 |

## 七、迁移存量软件（按需，不默认做）

迁移前必须备齐三样：`① 原路径 ② 配置/数据位置 ③ 回滚步骤`；搬完要**真的能启动**才算完成。

本机两个已踩的坑（nginx `C:\nginx` → `D:\Program Files\nginx`，2026-10-04）：

1. **命令行路径要用正斜杠**：`nginx -p "D:/Program Files/nginx"`。
   尾部反斜杠 `-p "D:\...\nginx\"` 会把命令行引号转义，nginx 把整串当路径 → `CreateFile() ... failed (123)`。
2. **Windows 防火墙会按新路径重建规则**：旧路径的 Allow 规则变成指向不存在程序的死规则，
   新路径则被记为默认 **Block**。迁移后必须用**管理员**权限删死规则并放行新路径：
   ```powershell
   Remove-NetFirewallRule -DisplayName 'nginx.exe','nginx'
   New-NetFirewallRule -DisplayName 'nginx (D)' -Direction Inbound -Action Allow -Protocol TCP `
     -LocalPort 11435 -Program 'D:\Program Files\nginx\nginx.exe' -Profile Any
   ```

   **无管理员权限时不要停**：把上面两条命令**贴给用户执行**（附影响面），继续做其余步骤，汇报里标注「**待用户以管理员身份执行**」——提权那一步按红线纪律交用户本人执行，不为它中断整批迁移。
