---
name: skill-trim-with-capability-transfer
description: 技能降量的可执行 playbook（停入口、不丢能力）。当用户说「技能太多要精简」「降量 / 停用技能」「同域不装第二个」「几个技能抢同一个触发」「停掉的技能能力不能丢」「skills-disabled 怎么回退」「降量后周检 / 全局体检判红」时使用。按引用关系分档决定谁能停，把只此一家的能力用真代码或规则条目搬进留存内容，同步会被钉死的机械判据，再用周检加提及扫描收口。不用于 C 盘腾空间（走 disk-junction-migration）；外部分享包并入本机、本机出包发给别人在 DSH 侧没有承接技能。
---

# 技能降量与能力迁移

## 何时用 / 何时不用

- 用：技能数偏多要精简、同域出现第二个技能、几个技能的 description 互相抢触发、要停用某些技能但**不能丢能力**、`skills-disabled/` 里的技能要回退、降量之后周检或全局体检判红。
- 不用：C 盘腾空间 → `disk-junction-migration`（外部回流包并入 / 本机出包在 DSH 侧无承接技能）。

## 三条前置（违反任何一条就停手）

1. **降量强度必须弹窗拍板**：`ask_user_question` 给 ≥3 档（停多少、停哪些域）+ 推荐项，写明每档的收益与代价；不自行整批停用。**超时口径由预设提供（前台 180 / 后台 60），不要自己传 `timeout` 参数**。
2. **停用＝移入 `~/.dsh/skills-disabled/`**（移走不删、可随时移回）。**绝不 `rm`**，也不要在降量过程中删任何技能目录。
3. **改任何已有文件前先备份**：`AGENTS.md`、`hooks/*.ps1`、`plugins/**`、`memory/*.md`、技能正文都算（停在 `skills-disabled/` 的技能目录本身就是备份）。

```bash
HOME_D=~/.dsh
SK=$HOME_D/skills; DIS=$HOME_D/skills-disabled; BK=$HOME_D/backups/skilltrim-$(date +%F)
SCAN=$SK/skill-trim-with-capability-transfer/scripts/skill-mention-scan.cjs
mkdir -p "$BK"
```

## 阶段 1 · 引用分档：决定谁能停

先读已有的盘点（**DSH 侧没有现成的技能盘点表**，直接从 `~/.dsh/skills` 与 `~/.dsh/skills-disabled` 现列），**不要重新盘点**，在其基础上拍板强度。然后按引用关系分三档：

| 引用形态 | 判据 | 处置 |
|---|---|---|
| 硬保留 | `AGENTS.md` / `hooks/*.ps1` / `plugins/**` 里有 `` `name` `` 反引号引用 | 不停（停了必然悬空） |
| 可停但需随改 | 仅被 `memory/*.md` 提到 | 停，并同批更新那几处提及 |
| 点名依赖 | 被留存技能的正文点名（如「细节见 X 技能」） | 要么留着，要么改那一行 |

**别只信周检**：Qoder 侧实测周检的严格引用检查只覆盖 4 个技能，而真实被引用集是 21 个（含 `i-have-adhd` 这类短名，正则会漏）；DSH 侧的周检 `rules-weekly-audit.ps1 -Check` 只判技能名 kebab-case 与目录一致性，**引用完整性没有覆盖**。自己扫一遍四类引用源再定名单：

```bash
cd "$HOME_D"
comm -12 <(ls skills | sort) \
         <(grep -rhoE '`[a-z0-9][a-z0-9-]*`' AGENTS.md hooks plugins 2>/dev/null | tr -d '`' | sort -u)
```

**判据（必须检查，否则名单不可信）**：`comm` 输出**非空**才算跑对了目录（`cd` 失败 → `ls skills` 报错 → 交集为空，却会被读成"没有硬保留技能"）；输出为空即判本次分档失败并停，先核对 `$HOME_D` 与目录名再重跑。

输出＝被反引号引用且确已安装的技能名（硬保留候选）。再对 `memory/` 里提到的名字逐条判「可停但需随改」。

## 阶段 2 · 停入口不丢能力（本流程的核心）

用户口径：**尽量不要缺失能力，如果关闭相近，要把相近的能力抽离补充到留存内容中。**

1. **读留存技能的正文核实覆盖，不按名字猜**。名字像不等于覆盖到——实测：小程序域确实已被留存技能覆盖（记一条文档即可）；Python / Redis / Spring / AOP 在留存内容里**有缺口**（必须补）。
2. **落地形式优先「真代码 > 规则条目 > 纯文档」**：
   - 真代码：把只此一家的能力写成承接技能里的新脚本（实测：给按需库技能 `office-docs` 增加 docx-surgery 脚本——解包 / 回包 / 跨 run 文本替换 / 校验，`--selftest` 11 通过 0 失败，含「非 zip 文件头」负对照）。新文件不碰并行会话在改的老文件。
   - 规则条目：并入已有技能的对口章节（Redis → `database-discipline`；Spring / AOP → `java-spring`）；整块新领域才新建技能 `skills/<域>/SKILL.md`（description 里写清触发条件——不碰该域就不吃上下文）。
3. **被停技能自带的脚本原地保留**（不搬、不覆盖，避免与并行会话互相覆盖），但**必须补齐依赖让它真能跑**。反例（Qoder 侧实测）：官方 `docx` 的 Python 脚本缺 `defusedxml`，`unpack.py` 直接 `ModuleNotFoundError`；补装（官方源）后五个脚本全部 exit=0。**这是「能力还在」的可失败证据，写文档不算。**（DSH 侧 `skills-disabled/` 现在是空的，只放 README 约定。）
4. **产能力去向表**：在承接技能里落 `CAPABILITIES.md`（谁的能力搬到哪、怎么调、依赖怎么装），并从该技能的 SKILL.md 指过去。

判据：迁移完成＝承接内容里有可跑的代码或可执行的规则条目 **+** 一条能失败的验证命令（退出码为证）。

## 阶段 3 · 同步会被钉死的机械判据

降量必然打红一批「计数 / 集合」类断言，先过一遍再谈验收：

- 技能名必须 kebab-case 且与目录名一致（`~/.dsh/hooks/rules-weekly-audit.ps1` 判定，改名会连带打红这一条）。
- 技能数本身**没有**写死下限（Qoder 侧的 `verify-global-setup.js` 未移植）；但降量前后要自己记准总数，别让汇报里的数字漂移。
- 分享包 / 规则文档里的计数（如「家用机实际装 N 个」）。
- 任何「文档称 X / 实测 Y」的对照断言。

每改一条自问：**改动之后，这条断言还能失败吗？** 恒真的判据等于没有判据。改脚本前先 `cp` 到 `$BK/`。

## 阶段 4 · 收口验收（每条都要能失败）

```bash
pwsh -NoProfile -File "$HOME_D/hooks/rules-weekly-audit.ps1" -Check   # exit 0
node "$SCAN"                                                          # 提及扫描（见下）
```

**提及扫描必须分两栏**（最容易做错的一步）：扫 `AGENTS.md` + `hooks/` `plugins/` `memory/` `skills/` 里对「已不在 `skills/` 的名字」的提及。扫描器读 **`.md` / `.ps1` / `.yml` / `.yaml`** 四类（2026-10-13 起：此前只读 `.md`，`hooks/*.ps1` 与 `plugins/**` 的 `*.yml` 里的引用会整片漏掉）；**`.js` / `.cjs` / `.mjs` 仍不扫**（这类文件里技能名大量出现在注释与变量名中，噪声远大于信号），对它们自己另外 `grep` 一遍兜底：

- **有意留痕**：写明「已停用 X，能力去向见 Y」、回退说明、收敛决策记录 —— 正确留痕，**不要当告警反复改**。
- **真悬空**：把已停技能当「当前可用」引用（「细节见 X 技能」）；记忆里 `[[链接]]` 指向不存在的文件或文件名不符（实测 4 处：3 处改指向、1 处由新建目标文件补上）。

**回退可失败验证**（做一次往返，证明「可回退」不是口头承诺）：

```bash
mv "$DIS/<一个技能>" "$SK/" && ls "$SK/<该技能>/SKILL.md"   # 计数 +1 且 SKILL.md 就位
mv "$SK/<该技能>" "$DIS/"                                     # 再移回，计数复原
```

实测口径：55 → 56 → 55。

## 阶段 5 · 留痕

- 落一条记忆（memory MCP：`mcp__memory__create_entities`，名字形如 `reference-skill-trim-<日期>`）：降量口径（停多少、依据哪一档）、被停清单、能力去向、回退命令；查回用 `mcp__memory__search_nodes`。
- 更新所有技能数口径（`AGENTS.md` / 记忆 / 汇报里的计数要一起改，否则下一轮自己就对不上账）。
- 本技能到留痕为止（出包类工作 DSH 侧没有承接技能）。

## 已知反例（2026-09-29 实测，逐条对号）

- **只信周检会误停**：周检严格检查只覆盖 4 个被引用技能，真实集 21 个。
- **分清「我打红的」与「本来就红的」**：Qoder 侧降量后体检报 6 条 FAIL ＝ 2 条判据被钉死 + 4 条既存悬空链接。DSH 侧的周检只判技能名与目录一致性，降量**不会**钉死它；真出现判红先看是不是既存缺口（别当自己改坏），也别把既存缺陷放着。
- **两栏混判会改坏正确留痕**：8 条「已停技能名仍被提及」里，console 三件属有意留痕、`docx` / `Excel---XLSX` 属待更新。
- **文档充数不算能力迁移**：`defusedxml` 没装时官方脚本 `ModuleNotFoundError`，装完 exit=0 才算数。
- **能力去向文档本身会踩分享包敏感词门禁**（写到内网字样就被拦）→ 改写法，不绕过门禁。

## Resources

`scripts/skill-mention-scan.cjs` — 只读提及扫描器：列出 `AGENTS.md` + `hooks/` `plugins/` `memory/` `skills/` 中对「已不在 `skills/` 的名字」的提及，每条给 `文件:行` + 上下文 + 名字状态（在 `skills-disabled/` ＝可回退；两处都没有 ＝ 不明来源，用 `--names-file` 补），并对「已停用 / 能力去向 / 回退」等措辞打**留痕提示**。扫描范围＝扩展名白名单 **`.md` / `.ps1` / `.yml` / `.yaml`**；`.js` / `.cjs` / `.mjs` 故意不扫（技能名大量出现在注释与变量名中，噪声大于信号），改用人工 `grep` 兜底。

```bash
node "$SCAN"                          # 名字来源＝skills-disabled/ 全部目录
node "$SCAN" --names-file names.txt   # 追加历史名字（曾彻底移除、不在 skills-disabled/ 的）
node "$SCAN" --strict                 # 有「待读」命中即 exit 2，可做门禁
node "$SCAN" --selftest               # 自测：正例 / 留痕 / 不明 / 词边界 / 扩展名正反例 / 负对照
```

命中是**待读线索不是判决**：留痕提示只是措辞启发式，最终「有意留痕 vs 真悬空」由人 / AI 读原文判定。脚本绝不写文件、绝不删文件。
