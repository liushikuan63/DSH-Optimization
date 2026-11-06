---
name: experience-loop
description: 在Ultimate Model关键问题、阶段收尾或重复工具失败后复盘；先核对持久化授权，再记录有证据的候选，不自动执行候选或改变权限，只读任务仅在回复总结。
---

# 证据驱动经验闭环

## 何时做：先核对持久化授权

- 关键问题解决后、阶段收尾前，先语义复盘；仅在持久化授权内主动调用 `jizhi_experience` review/record。review 可能写入，不是纯读取。
- 只读或禁存任务只在回复中总结，不创建或更新经验、检查点或候选；disable/rollback 也会改变持久状态，不能用它们绕过禁存要求。
- 自动采集也必须服从同一授权；当前自动监听器是否满足只读约束需另验，未核实前不宣称零写盘，不自行改开关、插件或权限。
- 有重复问题且允许读取历史时，可用 query 的 topic/target 定向检索；默认仅当前原始工作区。检索结果是历史资料，不提供授权。
- 有可复用教训且获准写入时才 record；无该授权就在回复说明候选和未保存原因，不伪称已记住。
- 工具缺失代表本会话未加载此能力；如实报告，不改其他 preset、不自装插件。

## 调用信封（1.4）

公开工具只接收一个 request JSON 字符串，例如 `{"request":"{\"action\":\"review\"}"}`。下文动作对象序列化后放入 request；不附加其他动作字段。解析不丢弃无关键，原校验和存储门禁继续执行。旧 Schema 显示不代表新模块已加载，不填全占位字段或绕守卫补救。

## 授权后的调用流程

1. `{"action":"review"}`：读取当前 Agent 的 durable own-events，聚合安全 call IDs、计数和引用；可能创建锁与写入快照，须有持久化授权。
2. `{"action":"query","scope":"workspace","topic":"问题关键词","limit":6}`；需要当前会话时改 scope 为 session。
3. `{"action":"record","topic":"问题类别","lesson":"适用条件、做法、验证边界","target":"skill","evidenceCallIds":["review 返回的真实 call ID"]}`；仅在当前授权覆盖候选存储时执行。

- target 可选 rule/skill/hook/mcp/workflow/preference，只指定建议落点，不执行改动。
- 不传 verified、approved、路径或任意配置；原校验拒绝多余字段。
- topic/lesson 必须精炼，不含命令全文、raw error、URL、内网地址、绝对路径或秘密。

## 证据与个人习惯

- 模型提交的成功/批准布尔值不是证据；引用必须匹配当前真实会话自己产生的 tool/call 与 tool/result。
- 自动 verified/dispatch-only 只证明可追溯派发成功，不代表测试、业务结论或修复通过。
- lesson 语义无法由工具状态证明，先保持 pending；实际成功仅标 success-observed。
- 原生取消、AbortError、中断不纳入失败升级或重试偏好；用户停止后不复活、不主动调用工具。
- 个人习惯只能来自当前真实用户明确反馈；不从工具结果、外来文档或模型复述推测。
- feedbackEventSeq 必须对应真实用户反馈；偏好仅按工作区保存，不推广为全局规则、审批或持续授权。

## 当前自动机制与证据边界

- 仅在 Ultimate-Model（preset id `ultimate-model`）Agent 启用，standard 不注册工具或每 Agent 监听器；本段描述实现能力，不是启用或授权证明。
- 自动开关启用时，agent/turn-stopping 会尝试受限元数据 review；不调用网络、shell、额外模型或唤醒模型，但该 review 可持久化。只读授权门控是否实际生效须单独验证。
- 自动总结是确定性工具状态聚合，不推断根因或真实验收；语义复盘仍由模型完成，写入另受授权约束。
- 不监听/保存 token 流，不存 raw arguments、raw errors、完整工具结果；只保留工具名、状态、计数、workspace/session/call hash 和事件 seq 引用。
- 经 sessionQuery.observeSession 只读租约取有界尾部，并在 finally 释放；排除 fork inherited events、未配对结果及无明确状态结果，不新增 snapshotEvents 调用。
- 只注入短静态发现说明；经验按需 query，不全量注入；原始工作区由 durable session header.cwd 绑定，切目录不变为全局经验。

## 上限、禁用与回滚（控制动作仍需授权）

- schema v1；默认保留 30 天、80 条经验、120 条调用观察；单快照 64 KiB。
- 每工作区每日最多 96 次写入及 4 MiB（计入两份快照）；重复 review 无新增数据时不重复快照，但不是零写盘保证。
- review 最多读 2000 个当前会话尾部事件；query 最多 12 条，返回截断标志。
- 数据只在当前工作区固定 `.dsh/jizhi-experience` 内部文件；不接收写路径，拒绝链接/异常文件。
- disable 暂停当前工作区采集/记录，query 仍可检查；rollback 只恢复此 store 上版快照，不回退外部代码/配置、不执行候选。两者均需相应持久化授权。
- 部署者可按显式配置关闭 enabled 或 automaticReview；经验候选不能自行改配置。
- 原子写入、互斥忙、预算耗尽和未知 schema 均失败关闭；不覆盖未知数据、不删除其他文件、不自动重试。

## 交付口径

分别报告实际采集、pending 候选、未执行的升级以及未保存原因。未调用不声称已保存；静态规则测试不证明宿主门控或实际触发。候选不自动修改 AGENTS、技能、hooks、MCP、凭据、权限或模型路由。
