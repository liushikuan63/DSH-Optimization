---
name: disk-junction-migration
description: Windows C 盘腾空间的「先分类再动手」流程与 junction 搬迁安全执行。当 C 盘水位告警或空间不足、要把占空间大的数据目录搬到其他盘（DSH 的 logs 与 sessions、IDE 与构建缓存、Android 模拟器镜像、浏览器用户数据）、提到 junction / mklink /J / rmdir 断链 / robocopy /XJ / 崩溃产物（hs_err_pid*.mdmp、java_error_in_idea*.hprof、replay_pid*.log）/ npm 缓存改路径 / idea.system.path / GRADLE_USER_HOME，或首次应用分享包时需要问「哪些迁、迁到哪个盘符」时使用。按 DELETE / TRIM / JUNCTION / OFFICIAL / SYSTEM / NEVER 六档路由处置手段，含清理与迁移两组弹窗、回滚路径与迁移后复验。不用于普通临时产物清理（走 /clean-temp），也不替代 /clean-disk 的清理执行器与阈值。
---

> 执行器边界：本文涉及的 tmp-sweeper、disk-sweeper、disk-migration-candidates 和 migrate-qoder-data 等历史执行器未随本包分发。先在目标机发现并审查真实入口、来源和权限；不存在时只做只读分析与方案，明确执行缺口。不要照抄作者 home 路径，也不为补齐入口自动安装或扩大权限。

# Windows C 盘腾空间：先分类再动手

## Overview

C 盘紧张时的错误做法是「找到一个目录就搬一个」。本技能要求先跑只读候选扫描，把每个候选按**处置手段档位**归类，再按档分流：能直接删的不搬，有官方改路径开关的不拿 junction 代替，Windows 已知文件夹走系统向导，只有自有 / 工具数据才用 junction，系统与企业管控持有的路径一律不碰。

执行器与阈值不在本技能里复制，全部指向 `~/.dsh/scripts/` 的单一真源：

| 用途 | 入口 |
| --- | --- |
| 只读候选扫描（分档 + 体积 + 推荐动作） | `bash ~/.dsh/scripts/disk-migration-candidates.sh [--top N]` |
| 清理执行（一档 / 三档、归档与回取） | `node ~/.dsh/scripts/disk-sweeper.js`（细则见 `/clean-disk`） |
| DSH 数据目录搬迁（**主入口：PowerShell，由用户本人在真实终端跑**） | `powershell -NoProfile -File ~/.dsh/scripts/migrate-qoder-data.ps1 -To D [-Apply\|-Undo]`——缺 `-To` 即拒跑、不带 `-Apply` 是只读 dry-run、目标盘余量不足即拒；默认只处理 `~/.dsh` 下的 `logs` 与 `sessions` |

边界：清理侧的阈值、档位与归档闭环归 `/clean-disk`，本轮临时产物归 `/clean-temp`，本技能只做**分档路由与搬迁执行安全**；外部分享包并入本机（比对 / 攻击面扫描 / 逐文件分桶）在 DSH 侧**没有承接技能**（Qoder 侧原归 `merge-inbound-qoder-package`，本次未移植）——遇到那类任务先说明缺口，不要照搬旧命令。

## Agent 权限契约（先读这条）

搬迁执行器**只能由用户本人在真实终端里运行**，Agent 不得代跑、也不得设法绕过：

- `migrate-qoder-data.ps1` 的防呆是「缺 `-To` 即拒跑 + 不带 `-Apply` 就是只读 dry-run + A/B/C 系统盘直接拒 + 目标盘余量不足 15% 即拒 + 客户端还在跑就拒」。
- 依据（Qoder 侧 2026-09-23 实测；DSH 侧机制同构）：客户端运行中把数据目录改名，正在跑的会话写文件时路径失效（ENOENT）→ 会话无法继续 → worker 崩溃退出（exit 1）。**运行中搬迁 = 数据分叉，属最坏的「假成功」**。
- 因此本技能的 Agent 边界是：**跑只读 dry-run（`-To D` 不带 `-Apply`）、出分档清单、弹窗收口径、给出用户可直接粘贴的命令与回滚方案**；`-Apply` / `-Undo -Apply` 交给用户本人，并在汇报里写明「此刻我做不到是因为要停机 + 由本人执行」。
- 只读入口 Agent 可以跑（本批实测 exit 0）：`disk-migration-candidates.sh`、`node disk-sweeper.js`（不带 `--apply`）、`migrate-qoder-data.ps1 -To D`（不带 `-Apply`）。
- 旧入口 `Qoder数据目录迁移.cmd` / `qoder-data-migrate.sh` / `migrate-data-to-disk.sh` **未移植到 DSH**，它们的命令不要再照抄。
## 步骤 1 · 只读盘点

1. 跑 `bash ~/.dsh/scripts/disk-migration-candidates.sh`（只读，不删不搬不改配置）。
2. **不要全盘 `du`**：用户目录 / `AppData` 全量扫描实测超时；候选由脚本内的白名单定向统计给出。
3. 需要额外数据时才单独量测个别路径，且限定深度；改过这个脚本先 `bash -n` 再跑。
4. 输出已按档位排好序并给出「可释放（DELETE+TRIM）」「可搬迁（JUNCTION+OFFICIAL）」两个合计，直接用作弹窗素材。

## 步骤 2 · 六档路由判据

按此优先级决定处置手段（**高位覆盖低位**，同档看具体度）：

| 档位 | 判据 | 处置 |
| --- | --- | --- |
| `OFFICIAL` | 软件自带「改存储路径」开关 | 用官方开关。绝不拿 junction 代替——注册表 / 配置里可能记着旧路径 |
| `SYSTEM` | Windows 已知文件夹（Downloads / Documents / Desktop） | 「属性 → 位置 → 移动」向导，不手搓 junction |
| `JUNCTION` | 自有或工具的数据目录，路径被硬编码且无开关 | 走迁移脚本（须先完全退出客户端） |
| `TRIM` | 缓存类，软件会自行重建 | 只删超限内容、**不删目录本身**；能用 `npm cache clean` / `pip cache purge` 等官方命令的先用命令 |
| `DELETE` | 崩溃 / 堆转储产物，进程已死不会再引用 | 确认后直接删，比搬迁省事 |
| `NEVER` | 系统或企业管控直接寻址的路径 | 不迁不删，只作说明展示，**不进弹窗选项** |

`NEVER` 名单、各软件官方开关的写法与理由见 `references/tier-playbook.md`。要点：`AppData\Local\Packages`、`AppData\Local\Microsoft`、`%APPDATA%` 根、`Program Files` 不动——junction 可能被卸载器 / 更新器穿透删掉真源。

另有硬否决路径段（任一段命中即跳过，即使被显式指到）：`memory` / `rules` / `scripts` / `commands` / `credentials` / `.git` / `settings.json` / `qoder-*-cwd` / `dsh-*-cwd`。规则和记忆不能被「清理磁盘」顺手吃掉。

## 步骤 3 · 清理与迁移两组一起问

**不允许只盯着缓存**。用 `ask_user_question` 一次问两问（**超时口径由预设提供：前台 180 / 后台 60——不要自己传 `timeout` 参数**），每组都写清体积、收益、代价、可回退性：
- 两问都涉及不可逆动作，**首项标签不得带 `(Recommended)` / `（推荐）`**（红线例外，见 `AGENTS.md` §一·补）——推荐意见写在题干里（如「推荐 DELETE 全清 + TRIM 挑纯缓存」）。
- 第一问 · 清理组（`DELETE` + `TRIM`）：题干推荐 `DELETE` 全清（崩溃产物可达数 GB）+ `TRIM` 只挑纯缓存；代价写「下次装包 / 跑 E2E 要重新下载」。
- 第二问 · 迁移组（`JUNCTION` + `OFFICIAL`）：题干推荐 `JUNCTION` 迁 DSH 数据 + `OFFICIAL` 里真正在用的包缓存；并写明 `JUNCTION` 那半**需停机 + 由本人执行**；代价写「要退出 DSH Desktop、由本人手动执行」。
- 两组都拿到答复才动手；**超时未答保持 `pending`，不要依赖自动作答**；**停机类动作不做默认**——那必须等用户本人执行。

## 步骤 4 · 分流执行

1. `DELETE` / `TRIM` → 交 `/clean-disk`（`disk-sweeper.js`），归档落点选他盘（把 C 盘的东西挪到 C 盘不叫清理）。
2. `OFFICIAL` → 改配置 / 环境变量（`npm config set cache`、`GRADLE_USER_HOME`、`UV_CACHE_DIR`、`settings.xml` 的 `localRepository`、`idea.system.path`、`--user-data-dir`、`ANDROID_SDK_ROOT` / `ANDROID_AVD_HOME`、`PLAYWRIGHT_BROWSERS_PATH`）。**环境变量只对新进程生效**：删旧源前先重启宿主软件 / 终端，否则旧进程还在往旧路径写。
3. `SYSTEM` → 给用户向导路径与注意事项，由本人操作。
4. `JUNCTION` → **给出命令由用户在真实终端跑**（Agent 只跑不带 `-Apply` 的 dry-run）：

```
powershell -NoProfile -File ~/.dsh/scripts/migrate-qoder-data.ps1 -To D          # 迁移计划（只读 dry-run）
powershell -NoProfile -File ~/.dsh/scripts/migrate-qoder-data.ps1 -To D -Apply   # 执行迁移（需先退出 DSH Desktop）
powershell -NoProfile -File ~/.dsh/scripts/migrate-qoder-data.ps1 -Undo          # 回滚计划（只读）
powershell -NoProfile -File ~/.dsh/scripts/migrate-qoder-data.ps1 -Undo -Apply   # 真的回滚
```

执行器位置 `~/.dsh/scripts/migrate-qoder-data.ps1`；默认只搬 `~/.dsh` 下的 `logs` 与 `sessions`（append-only 的日志与会话记录，2026-10-13 实测 0.1MB / 137MB），`skills` / `scripts` / `memory` / `hooks` / `plugins` **一律不迁**。目标落在 `{盘符}:\dsh-data\dsh\<条目>`，迁移后原目录改名 `*.bak-migrating` 保留；平稳几天后由**本人**删除（脚本不提供自动清理开关）。
## 步骤 5 · junction 安全流程与回滚

脚本对每个目录执行的顺序**不可反**：复制 → 逐文件核字节 → 原目录改名 `*.bak-migrating` 保留 → `mklink /J` → 经原路径读文件验证。任何一步不过就停下并打印回滚命令，源数据保持完好。

关键原语（都是实测过的坑）：

- `robocopy` 必带 `/XJ`：不带会穿透已有链接去拷真源。
- 建链：`env -u MSYS_NO_PATHCONV cmd //c mklink //J <win路径> <目标>`；脚本顶部导出 `MSYS_NO_PATHCONV=1`，否则 Git Bash 会把 `/J` `/E` 改写成本地路径。
- **断链只能 `cmd /c rmdir <链接>`**（并带 `< /dev/null`，rmdir 删非空联接可能弹确认而挂住）。`rm -rf` 会穿透删掉真实数据，禁止。
- 回滚单目录：`cmd /c rmdir "<C:\...\logs>"` 只断链，再 `mv "<...>.bak-migrating" "<...>"` 还原。
- 判联接用 `fsutil reparsepoint query` 或 `dir /AL`；PowerShell `New-Item -ItemType Junction` 建的目标在 `dir /AL` 里显示为 `\??\E:\...`（NT 命名空间），`if exist` / robocopy / move 都不认 → 取到目标先剥 `\??\` 与 `\\?\` 前缀。
- 验证联接可读要 `ls` / `cat`（会穿透），**别用 MSYS `find`**（不穿透 → 假阴性，实测两次踩到）；读验证要**递归**找任意文件——`projects` 顶层只有 slug 目录、没有文件，只看顶层会把“已迁移成功”误报成失败。
- 默认只搬每个客户端目录下的 `logs` / `sessions`；`skills` / `scripts` / `memory` / `hooks` / `plugins` 不迁（体积小，且经链接读取的兼容性未证实）。
- **更新链路目录继不迁**：`%LOCALAPPDATA%\dsh-plugin-desktop-updater` 与 `dsh-plugin-desktop-beta-updater`（实测本机存在）属安装 / 更新交接中枢，归 NEVER。依据（Qoder 侧 2026-09-24 实测，DSH 同构）：把它们做成 junction 后更新反复卡在 `[DesktopUpdate] interrupted-install-handoff`（包已下载完好，失败在执行 / 交接环节）。`%APPDATA%\DSH Desktop`（Roaming 侧，实测存在）按用户实测可迁；本脚本默认不碰 AppData。
- 回退不依赖 `*.bak-migrating`：没有备份时工具自动改走「从联接目标复原」（复制到 `<原路径>.restore` → 校文件数 → `rmdir` 断链 → 改名）。
- 迁移前脚本用 `tasklist` 枚举进程确认客户端已退出；**取不到进程列表就中止**（fail-closed），不要为了跑通而关掉这个检查。

## 步骤 6 · 迁移后复验

四条都要有能失败的判据：

1. `-To D`（只读 dry-run）确认计划里每个条目**确为 junction 且解析到同一真源**，不是「两侧目录都存在」；要核链接指向用 `fsutil reparsepoint query` / `dir /AL`（记得剥 `\??\`），经原路径 `cat` 一个真文件才算读得到。
2. `pwsh -NoProfile -File ~/.dsh/hooks/rules-weekly-audit.ps1 -Check` —— 周检应健康（`exit 0`）；判红说明链接影响到规则 / 技能读取。
3. 功能复验：重启 DSH Desktop 后新开一个会话能正常启动、会话记录能落到新位置；`OFFICIAL` 类改动要重启宿主后再验。

归档 / 清理侧再补一次不带 `--apply` 的扫描，核对「清理前 GB → 清理后 GB」与剩余计数，并把 `--restore "<归档目录>\manifest.json"` 整条命令抄进汇报。

## 常见错误

- **把「两侧一致」当成迁移成功的判据**：合并成 junction 后，「比对两侧是否一致」恒真。判据要换成「确为链接且解析到同一真源」。
- **拿 junction 代替官方开关**：注册表可能仍指旧路径，软件行为看似正常，更新 / 重装时踩雷。
- **连根删缓存目录**：软件假定该目录存在，删目录等于把「清理」做成「弄坏正在用的软件」。
- **Agent 试图绕开防呆**：造 tty、去掉防呆检查、代敲 `-Apply` 都不允许；这类操作的正确出口是交给用户本人。
- **只搬不验就读**：`*.bak-migrating` 存在且原路径不是 junction = 上次迁移未完成，先按脚本提示补做，别直接 `--cleanup`。
- **`bash` 脚本里的两类实测写法坑**：`$(printf ...)` 命令替换会剥掉行尾换行，多行清单要落临时文件收集；`{ ...; }` 块尾误写成 `fi` 会直接语法错。改完先 `bash -n`。

## Resources

- `references/tier-playbook.md`：六档 × 具体条目与官方开关写法、`NEVER` 名单及理由、硬否决路径段、实测坑与日期、迁移后复验判据清单。执行前先读它对齐档位。
