---
name: clean-disk
description: C 盘空间不足时清理早期任务记录 / 缓存——看水位 → 列清单 → 一次问两问 → 执行 → 复验并落长期记忆（用户输入 /clean-disk 调用）
disable-model-invocation: true
---

> 执行器边界：本文涉及的 tmp-sweeper、disk-sweeper、disk-migration-candidates 和 migrate-qoder-data 等历史执行器未随本包分发。先在目标机发现并审查真实入口、来源和权限；不存在时只做只读分析与方案，明确执行缺口。不要照抄作者 home 路径，也不为补齐入口自动安装或扩大权限。

# /clean-disk

磁盘清理是**不可逆 + 系统级**动作，所以固定五步，**不允许跳过弹窗直接删**。
执行器是 `node ~/.dsh/scripts/disk-sweeper.js`（策略只在这一个文件里，别处不要另抄阈值）。

## 步骤

0. **先出候选名单（只读）**：`bash ~/.dsh/scripts/disk-migration-candidates.sh`
   它按 `DELETE / TRIM / JUNCTION / OFFICIAL / SYSTEM / NEVER` 分档列出用户目录与
   `AppData` 的大头、体积和推荐动作。**清理与迁移要一起问**，别只盯着缓存。
   - `DELETE`（`hs_err_pid*.mdmp` / `java_error_in_idea*.hprof` / `replay_pid*.log`）确认后直接删，比搬迁省事；
   - `OFFICIAL` 一律用软件自带的改路径开关，**别拿 junction 代替**；
   - `NEVER` 只作说明展示，不出现在可选项里；
   - **`JUNCTION` / `SYSTEM` 两档怎么搬**（分档路由、停机前提、复制→核字节→改名→建链→验证、
     回滚只能 `cmd /c rmdir`、迁移后复验）见技能 `disk-junction-migration`——本指令只管清理侧，
     搬迁执行器与阈值仍以 `~/.dsh/scripts/` 为单一真源，别在两处各抄一份。
1. **看水位 + 列清单（只列不删）**
   `node ~/.dsh/scripts/disk-sweeper.js --verbose`
   输出三档：
   - **一档**＝我方产物（`%TEMP%/dsh-work`、`~/.dsh/tmp`、`logs`），`--apply` 可清；
   - **三档**＝C 盘其余无用缓存 / 过期内容（npm / pip / 系统网络缓存 / 崩溃转储 / WER / Gradle /
     `%TEMP%` 残留 / 宿主 cache），**按 id 逐条点名**才可清；
   - **二档**＝会话记录 `~/.dsh/sessions`，**本工具永不删**，只报体积。
   退出码 `1` 就是"该弹窗了"的信号（水位低且有可清项、且没给 `--apply`）。
2. **选归档落点**（推荐项要用）：报告里的 `归档到他盘` 路径，或 `suggestArchiveRoot` 的建议
   （脚本已排除系统盘、按剩余空间取最大——**把 C 盘的东西挪到 C 盘不叫清理，叫原地搬家**）。
3. **一次问两问**（`ask_user_question`，不阻塞别的活；**超时口径由预设提供：前台 180 / 后台 60——不要自己传 `timeout` 参数**）：
   - **第一问 · 一档怎么处置**：① **归档到他盘再删源**（推荐理由写进题干：可回取、自动生成长期记忆条目）
     ② 直接删除（不可回取）③ 本轮不动只留清单。
   - **第二问 · 是否顺带清三档**：把报告里的 id + 各自 GB 列成选项（题干写明推荐纯缓存类
     `npm-cache,pip-cache,crash-dumps,inet-cache,win-temp`），允许用户只挑其中几个。
   - 两问都要写清**收益与代价**（释放多少 GB、下次装包/构建要重新下载、是否可回退）。
     这两问是**不可逆删除**，**首项标签不得带 `(Recommended)` / `（推荐）`**（红线例外，见 `AGENTS.md` §一·补）；推荐意见写在题干里。**超时未答保持 `pending`**，不要依赖自动作答。
4. **执行（两问都拿到答复后由 agent 代跑）**：归档优先（可回取）；选"本轮不动"就只留清单、不跑 `--apply`。
   破坏性的那一步本来就是显式 `--apply`（不给就只出报告＝dry-run），所以**不需要用户本人来敲**。
   ```
   node ~/.dsh/scripts/disk-sweeper.js --apply --archive "D:\dsh-archive"
   node ~/.dsh/scripts/disk-sweeper.js --apply --archive "D:\dsh-archive" --apply-extra npm-cache,win-temp
   ```
   `--apply-extra` **必须与 `--apply` 同时给**，id 不存在直接退 `2`（不猜用户想清哪个）。
5. **复验并记录**：再跑一次不带 `--apply` 的扫描，核对
   `清理前 GB → 清理后 GB`、一档 / 三档剩余计数、`失败 N`；把
   **`--restore "<archivedTo>\manifest.json"` 整条命令**抄进汇报——用户日后要取回就靠它。
   归档目录里的 `INDEX.md` 已经写好一条可直接粘贴的长期记忆条目
   （memory MCP 实体，含位置与取回命令），**落库用 `mcp__memory__create_entities`，查回用 `mcp__memory__search_nodes`——不要写文件式记忆**。

## 安全边界（违反即停手）

- **硬否决名单**：`memory` / `rules` / `scripts` / `commands` / `credentials` / `.git` /
  `AGENTS.md` / `settings.json` / `qoder-*-cwd` / `dsh-*-cwd`（宿主为每个会话建的目录）。
  命中任一路径段就跳过，**即使被 `--root` / `--extra-root` 显式指到**——规则和记忆不能被"清理磁盘"顺手吃掉。
- **三档只删超限文件、绝不删目录本身**：缓存目录通常被软件假定存在，连根删掉就是把"清理"做成"弄坏正在用的软件"。
- **归档顺序不可反**：先复制 → 逐文件核字节数 → 才删源；任何一步不过就把源留下并记失败。
- 不动用户文档目录（`Documents` / `Downloads` / 桌面）、不动数据库、不动注册表、不动服务。
- 需要凭据或影响他人会话的动作先问；不确定归属的产物**保留并在清单里点名**。
- 只想清本轮临时产物（截图 / 探针脚本）用 `/clean-temp`，它按"图片文本 >3 天、脚本 >15 天"的口径扫。
- **需要用户本人执行的只剩停机类**：本技能的清理动作不是停机类，**两问答复后由 agent 跑 `--apply`**（选"本轮不动"就只留清单）；
  「列清单 + 弹窗 + 给出可直接粘贴的命令」仍是硬要求，但**不再以"交给本人"收尾**。
  保留下来的红线：不可回取项须用户明选（第一问的「直接删除」）、脚本**默认 dry-run**（不给 `--apply` 只出报告）、
  归档顺序不可反、`--apply-extra` 必须点名 id、硬否决名单照旧。

## 自测与失效排查

- 改判据必须跑：`node ~/.dsh/scripts/disk-sweeper.test.js`（47 条断言，含"未点名不删""未知 id 退 2"
  "硬否决 survives `--apply`""归档→回取→purge 闭环"）。
- 心跳：`~/.dsh/tmp/disk-sweeper/heartbeat.log` 每次运行追加一行（`SCAN` / `APPLY`、剩余 GB、档位、计数）。
  **验证过配置正确 ≠ 验证过它真的生效**，判"最近有没有跑"看这行。
- 低水位在 DSH 侧**没有自动提醒**（Qoder 由 `session-budget.js` 在 SessionStart 注入，DSH 无对应物）——按需手动跑本技能；磁盘检查失败绝不能把会话卡住。
