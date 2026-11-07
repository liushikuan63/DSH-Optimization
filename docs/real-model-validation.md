# 受控真实模型验收记录

[English](en/real-model-validation.md) | 简体中文

本记录区分分享包、临时验收辅助和真实模型结果。临时辅助不在仓库、分享ZIP或长期DSH配置中分发。

## 首次实际执行：未通过

2026-11-07（Asia/Shanghai），用户明确批准最多6次DSH SDK主请求、首次请求起300秒，并保留当前订阅适配器既有内部HTTP重试。内部HTTP次数和实际账单消耗没有统计，不能把6次SDK计数当作6次HTTP生成请求。

目标是仅在独占工作区生成求和函数、Node测试和VIBECODING文档，保持原3个控制文件不变。实际发送6次SDK主请求；39.929秒后，第7次发送前被预算守卫中止。独立读取真实journal观察到6条settled主attempt、7次原生工具调用，最终turn/end为aborted。

| 原生工具 | 次数 | 结果 |
| --- | ---: | --- |
| skill | 2 | vibe-coding、assertion-discipline，两次均失败 |
| glob、read、pwsh、working_directory、progress_update | 各1 | 均失败 |

7个工具结果的实际异常相同：`Error: tool result must be losslessly JSON-serializable`。没有run_code或todo_write调用，也没有SDK retry marker；后者不能证明Provider内部HTTP没有重发。

最终产物0/3，仍精确只有原3个控制文件，其字节、SHA256和mtime全部不变。缺失的函数和测试没有执行，不能计为测试通过。此轮状态为`FAIL_BUDGET_EXHAUSTED_NO_ARTIFACTS`，不能用它证明模型已完成目标，也不能把失败简单归因于模型或Provider。

## 验收辅助的契约问题

原装SDK的`tools.guard`是同步拒绝契约。临时辅助为支持异步技能元数据查询，将注册回调改为async；返回的Promise被送入原本要求同步值的拒绝/结果路径，触发结果JSON准入异常。前一个完整离线Host测试发生在这次修改之前，修改后只测了辅助函数，遗漏了最终注册到SDK后的契约验证。

分享包与本机长期hook守卫使用同步回调，没有这次临时辅助的async改动。临时配置已移除，Home patch恢复原字节并正常重启。前6次调用和失败证据保留，不更换receipt来重置已消费的授权。

修复方案是先等待技能元数据，构建当前已注册、可供模型调用且位于UM目录的允许集合，再注册完全同步的守卫。修复验收必须用最终代码注册到原装SDK执行，保留旧代码RED与新代码GREEN，不能仅测试纯函数或以语法通过替代实际调用。具体离线修复结果及后续真实任务结果由验收报告关联，不把未执行项计为通过。

原装SDK实际注册/执行的定向反例已复现相同错误：旧async回调返回Promise，工具正文执行0次，结果JSON准入失败；替换为同步回调后，允许的工具正文执行1次并成功返回。这个因果验证修正了“只有Promise字符串错误”的初步推断，实际症状是JSON可序列化准入错误。完整Host任务链另行验收，定向GREEN不代替它。

## 同步修复后的离线与第二次真实执行

最终同步辅助的原装SDK注册RED/GREEN均已留存；15项预算/策略测试通过。最终源码还重新注册到独占原装Host：离线替身6次主请求完成技能、检索、目录、进度、三产物写读和只读Node4项测试，保护写入拒绝，原3文件字节及mtime保持，Host退出0、网络0。不是拿修改前的成功当作修改后证据。

用户额外批准补跑一次最多6次SDK主请求/300秒、保留既有内部HTTP重试。第二次实际执行在45.802秒后再次于第7次前触限，最终仍为aborted；两轮合计12次主请求，旧回执没有覆盖或重置。

这次10个原生工具调用中8个成功，生成calculator.mjs和calculator.test.mjs。两次拒绝仍来自临时辅助的额外限制：未允许edit；测试命令追加了 `2>&1; Write-Output "EXITCODE=$LASTEXITCODE"`，不再等于辅助的精确命令字符串，所以在执行前被拒。模型随后改用write完成编辑。这不是Provider、JSON序列化或新的EPERM故障；这些临时限制已经从现役配置移除，正常DSH没有本次验收的6次上限。

独立验收者先审阅两份代码，确认无网络/文件/进程副作用，再运行 `node --test --test-reporter=tap calculator.test.mjs`：13/13、0失败/跳过、exit0。额外5个正例、18个非法输入反例均通过，包含稀疏数组、typed array、boxed number、NaN和正负Infinity。两份模型文件验证前后未变，原3文件字节/哈希/mtime不变。

VIBECODING.md仍缺失，模型会话本身未执行测试，故第二次状态为`FAIL_BUDGET_EXHAUSTED_PARTIAL_ARTIFACTS`，整体只证明真实生成与独立验证的局部路径，不证明完整自主交付。两次终止均由验收预算守卫触发，也不能据此认定模型在正常无该临时上限时会自行提前结束。

随后只在新owned环境做了窄验证，没有安装budget/once/三文件辅助guard，也没有模型调用：正常UM6/原装SDK先read再edit副本注释成功，原样执行带上述后缀的pwsh命令，在read-only sandbox中13/13、EXITCODE=0，保护文件和真实两源的字节/mtime不变。初次未先read的edit被正常读后写保护拒绝，规范读取后通过；未绕过保护。PowerShell仍有两条ConstrainedLanguage启动stderr，原文私有保留，不宣称stderr为空。这份证据确认额外allowlist造成拒绝，不替代真实模型自主完成。

## 第三次真实执行：受控自主续任务完整通过

用户随后明确要求“完整自主交付验证，允许最多二十次”。本次作为额外最多20次SDK主请求，沿用首次请求起300秒、当前账号/模型和已批准的适配器内部HTTP重试；不是把历史12次清零，也没有把临时限制装成正常DSH的全局限制。

第三轮从前轮已有的calculator.mjs和calculator.test.mjs继续，要求模型实际验证、证明测试有效、补齐VIBECODING及最终交付。验收者没有重写这两份代码、代填文档或在运行中追加指导。原WORKSCOPE及三个保护文件保持原字节；旧控制JSON中的6次是历史事实，新20次预算在本轮任务与守卫中明确区分。最终辅助允许原生read→edit，以及四种精确的只读Node命令（默认/同进程，各含可选的既有输出退出码后缀），没有扩大写域或放宽沙箱。

最终辅助在实际SDK注册中再次保留旧async RED、新sync GREEN，16项预算/策略测试通过，并用冻结源码完成新的独占Host离线任务：原生read/edit/test、13项测试、三个保护文件写/编辑拒绝、精确6文件和网络0。独立核验最终源码/回执哈希后才安装一次性辅助；该辅助仍不进入分享包。

本次第一主请求为2026-11-06T23:56:18.489Z，正常完成于23:58:02.151Z（本地2026-11-07 07:56:18至07:58:02）。实际11次主请求、103.662秒，低于20次/300秒。独立journal有11条settled主attempt、1条真人user消息，最后seq127为completed，无在途步骤；完成时abortReason为null。之后正常卸载辅助的disposed状态是清理事件，不是任务被中止。第三轮状态为`PASS_CONTROLLED_REAL_MODEL_CONTINUATION`。

模型实际执行并留下输出的验证按时间顺序如下，不把工具isError字段单独当作测试结论：

| 阶段 | 命令类别 | exit | tests / pass / fail |
| --- | --- | ---: | --- |
| 初始GREEN | 同进程单文件测试 | 0 | 13 / 13 / 0 |
| 默认隔离环境诊断 | 默认Node子进程隔离 | 1 | 1 / 0 / 1，spawn EPERM |
| 有效RED | 临时去掉有限性校验，重跑同一测试 | 1 | 13 / 9 / 4 |
| 恢复GREEN | 恢复原校验，再跑同一测试 | 0 | 13 / 13 / 0 |

四次均0 skipped/cancelled。模型实际使用的有效命令是 `node --test --test-isolation=none calculator.test.mjs 2>&1; Write-Output "EXITCODE=$LASTEXITCODE"`；默认隔离诊断只去掉`--test-isolation=none`。实际edit先将`if (!Number.isFinite(value))`改为`if (false && !Number.isFinite(value))`，观察失败，再恢复原实现。4个失败包含父测试失败传播；不是4组独立输入。没有修改系统权限、关闭语言限制或去掉原测试。默认隔离的EPERM仍存在，同进程完整通过只适用于本单文件路径。

最终精确6文件，三项目标产物齐备。6773字节VIBECODING由模型生成，包含目标、两段计划、文件归属、真实命令/退出码、红绿结果、验收和未验范围；SHA256为`2c6750f72ea41a03f09f0a5b19a69a3e7bb87d3b2022c82f87de46edb2d6ec2c`。原三个保护文件的SHA256、字节数和mtime均未变；calculator/test最终哈希与第三轮开始前一致，calculator的mtime因授权故障注入/恢复可变化。

独立验收者完整审阅源码，再运行 `node --test --test-reporter=tap calculator.test.mjs`：13/13，exit0，0 fail/skip/cancel；额外5个正例、18个非法输入反例全部通过，复测前后6文件均未变。独立CLI复验与DSH只读沙箱中的模型实跑分开记录。原始journal SHA256为`86cd2450afa2911396abaaa4d4789a55f6ff2384599fe596309c0f7da54acc66`，私有保存，不导出账号、规则正文或其他会话。

22个工具结果有20个成功和2个可恢复错误：首次read时VIBECODING尚不存在；一次Get-FileHash命令超出临时精确白名单被拒。模型没有假报它执行了哈希命令，最终哈希/mtime由独立验收者核实。文档按类别列默认隔离与同进程验证，命令/结果均能与本轮journal对应；没有借用上轮独立测试冒充本轮模型实跑。

三轮SDK主请求合计6+6+11=23。第三轮新增预算未用9次，不继续消耗；内部HTTP次数、token或实际账单没有统计。前两轮失败保持原状态，本次PASS覆盖的是既有DSH代码的小型自主续任务，不能推广成从零完成任意复杂项目、长期稳定或所有插件组合无冲突。

## 已证实的采用与观察边界

同一个真实会话的durable user消息包含全局工作规则和Node EPERM兼容说明，UM常驻目标提醒则在system消息中。原装agent-instructions按user-role前缀注入，所以只扫描system消息的旧探针会漏掉全局规则。以上是本会话持久消息证据，未导出规则正文，也不冒充完整HTTP请求快照。

现役Loader也读回Vision Router active、entrySeen、fiberSeen均为true，确认宿主已采用持久已读设置。截图/UI离线验收与这些现役配置读回分开记录。

第三轮结束后临时runner和budget行已全部移除，Home patch恢复测试前的精确原字节并正常重启；现役DSH没有本次6次或20次临时上限。保持账号、模型、停用选择、经验数据和长期守卫。0.1.0/0.1.1的ZIP和tag保持原样，通过0.1.2交付最新报告与脱敏摘要；插件review.6代码及ZIP保持相同已验字节。本任务不再发送模型请求。


0.1.4运行排查没有新增模型请求。官方账号403、Bili空状态CORS和预期守卫拒绝已分别处理，当前证据及未解决边界见[运行修复指南](runtime-repairs.md)；不要因一条error日志就关闭保护或重置个人配置。
