---
name: github-ci-evidence
description: 用实际 run、job、step 和工作流调用链诊断 GitHub Actions 失败、配额疑点与重复构建成本。适用于 CI 无步骤即失败、日志缺失、runner 排队或离线，以及评估缓存、paths-ignore、并发取消和推送频率；先取证再改工作流。
---

# GitHub CI 取证与成本判断

由本机 Qoder 的 CI 配额诊断/成本审计流程提炼，保留可复验的方法，去掉历史账户数字、固定省钱阈值和平台专属指令。先区分真正的代码失败、执行通道问题与账户限制，再考虑优化。

## 诊断

- 从当前仓库 `.github/workflows`、本地调用脚本和用户指定的 run 确认目标。优先已连接 GitHub 工具；否则使用已登录的 `gh` 只读取相关 run/jobs/checks。认证检查只报告成功/失败，不输出 token 或完整认证信息。
- 记录 run id、attempt、head SHA、workflow、runner 类型、job 状态、实际 step 数与首个失败 step。`queued`、`waiting`、`action_required`、`cancelled` 与测试失败有不同含义。
- 无 job、零 step、很短的运行时间或日志 404 都是线索，单独不能证明配额耗尽：还可能是权限、runner 离线、取消、日志保留期或接口错误。检查运行/检查注释和权限错误；取最近可比的成功 run 作对照，有失败 step 则沿其日志定位代码或环境原因。
- 使用 API 返回的 `check_run_url` 或实际 check-run id 定位 annotations，不把 run id、job id、check-run id 当作恒定等价值。调用接口和字段以 [GitHub workflow jobs 官方文档](https://docs.github.com/en/rest/actions/workflow-jobs) 为准，资料不足时标注证据缺口。

## 成本与优化

- 先读本仓触发器、matrix、runner、构建前置步骤与历史样本。运行时间、账单分钟和实际费用分别记录；并发 job、重试、runner 类型以及工件/缓存存储都可能改变成本。费率、配额、账户范围从当前 [GitHub Actions 计费文档](https://docs.github.com/en/billing/concepts/product-billing/github-actions) 或账户可见数据核验，不沿用本机旧技能的价格与月度数字。
- `paths-ignore` / path filters：用有边界的提交样本估计实际命中比例，并沿 workflow → 入口脚本 → 子脚本/生成器确认这些路径是不是测试或门禁输入。不可为省分钟跳过实际质量检查。
- 并发取消：区分“发生重叠的比例”与“取消后剩余时间的估计节省”；已有消耗不会凭取消而消失。部署/发布任务的取消策略按该项目契约处理。
- 缓存：核验缓存命中、真实耗时、键中锁文件/平台/工具链，以及恢复后测试是否仍实际执行。自托管 runner：核验已有 runner 与标签、工具链、隔离、可信事件和维护代价；不因看到 self-hosted 文案自动注册服务或接入未知机器。
- 推送频率取决于当前会话授权和目标项目规则；保留可回滚增量，不将 Qoder/dsh 旧全局“每格 push”或某仓“攒批 push”推广到全部项目。

给出本次证据、可比对照、候选改动的收益/代价、估计口径与未验证部分。用户要求修复或优化时在授权范围内实施最小改动，并验证 workflow 结构、受影响的本地门禁和可获得的远端执行结果。收费设置、注册 runner、dispatch/cancel、推送或部署的授权不能从旧配置文件推导。
