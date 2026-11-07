# 自动限时核心库：开发者接口

`scripts/lib/diagnostic-deadline.mjs` 导出 `runGuard(plan, backend)`。它负责显式诊断任务的计时、身份核对、正常退出和恢复顺序；不提供特定应用的安装器或进程控制 backend。建议从独立进程调用，让协调者退出或模型停止推理时，计时器仍能工作。仅导入模块不会读写应用配置、安装插件、创建后台服务或监听全机活动；库不调用模型或网络。

`plan` 需要 `kind:"dsh-diagnostic-deadline-v1"`、当前 ISO UTC `createdAt`、未过期的 `validUntil`、新建的绝对路径 `receiptDirectory`、整数毫秒 `maxWallMs`、`observeMs`、`operationMs` 和 `pollMs`。总时钟包含预检、部署、启动、退出和恢复。`observeMs` 是启动自动停止的绝对时刻，须为正常退出及恢复预留足够时间；总预算不超过五分钟。每轮使用新目录，已有 journal 会拒绝重播。

backend 必须实现以下契约；返回派发成功不代表动作完成。

| 方法 | 必须保证 |
|---|---|
| `preflight()` | 验证应用/文件/依赖来源和权限、备份及本轮状态；未知字节或已有冲突应拒绝。 |
| `snapshot()` | 返回权威 `{run,processes}`。进程含 `pid,parentPid,startedMs`；活跃 run 含 `runId,pid,started,clean:false`，正常终态可为 `runId,pid,ended,clean:true`，不必保留 started。 |
| `apply()` | 只对已审核目标做受保护写入；固定预映像、目录及备份身份，提交不确定时可核对，不能盲目重试。 |
| `launchDiagnostic()` | 启动明确归属本轮的实例，返回 `pid,parentPid,notBeforeMs,notAfterMs`；不留下会在超时后迟发启动的 launcher。 |
| `normalQuit()` | 只向本轮已绑定实例请求正常退出。不能将命令发送成功当作 main/Host 已退出或 shutdown ACK。 |
| `cancelOwnedOperations()` | 有限时间内取消并等待自己的 helper/异步操作 settle；epoch/abort 检查须阻止 continuation 迟写或迟启动。取消未确认应失败，不能恢复或重启。 |
| `restore()` | 再核对全部相关进程已消失、正常终态和同一身份，用 CAS 精确恢复受信任备份；也须处理 apply 已提交但其返回/receipt 失败的情况。 |

终态身份只在 runId/PID 匹配、clean:true、规范 ended 不早于绑定 started 且不晚于当前时间，并且所有相关进程消失时接受。仍有 Host 存活时不恢复。ParentPID、创建时间和已观察祖先检查保持严格。

返回 `PASS` 要求没有失败、正常内容已恢复且没有超过时限；journal/receipt 错误同样保留为失败。正常恢复不证明 Host ACK、全部业务数据保存、账号状态或原生界面正常。backend 的约束是库保证成立的前提；操作系统停顿、休眠或阻塞 I/O 无法由普通 JavaScript 进程提供无条件硬实时保证。

运行 `node --test scripts/tests/diagnostic-deadline.test.mjs` 执行37项隔离回归。测试使用真实、带随机 nonce 的 Node main/Host 子进程和 `os.tmpdir()` 下 `mkdtemp` 创建的独占目录。退出通过本 fixture 的 nonce 协议请求；父测试只用 signal 0 探测存活，不按 PID 发送终止信号。清理在读取nonce或写入命令前先核对真实目录、创建身份、固定前缀，拒绝树中的符号链接、junction和多硬链接文件；读取nonce后、命令写入前及删除前再复核。命令以独占新文件创建并核对打开的文件身份，不写穿既有别名。所有fixture进程退出后才删除临时目录，源码树不留 fixture 产物。新增真实junction、标记替换和hardlink反例验证外部自有对照目录字节不变。依赖 pin 与小文件 CAS 由显式测试 backend 提供，不是生产 DSH backend。

这些证据仅为隔离核心库验证。此前本机 V1 诊断因终态 schema 差异导致的真实 FAIL 保持 FAIL；此公共库没有重新执行原生 DSH 诊断，也不能作为其安装或自动恢复成功的证明。
