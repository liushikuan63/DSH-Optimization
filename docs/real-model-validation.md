# 受控真实模型验收记录

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

## 已证实的采用与观察边界

同一个真实会话的durable user消息包含全局工作规则和Node EPERM兼容说明，UM常驻目标提醒则在system消息中。原装agent-instructions按user-role前缀注入，所以只扫描system消息的旧探针会漏掉全局规则。以上是本会话持久消息证据，未导出规则正文，也不冒充完整HTTP请求快照。

现役Loader也读回Vision Router active、entrySeen、fiberSeen均为true，确认宿主已采用持久已读设置。截图/UI离线验收与这些现役配置读回分开记录。

本轮不再追加模型调用。再次发送真实模型请求需要新的适用额度授权；离线重现、公开文档和归档更新可以继续。已发布版本的ZIP和tag保留，后续结果通过新版本交付。
