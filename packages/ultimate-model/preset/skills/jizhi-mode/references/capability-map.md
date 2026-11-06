# 按需能力地图

- 高频目录只提供描述；core/模式技能正文通过 skill 或 read 加载，library 经 jizhi_skill_search 定位。无命中不等于宿主无能力；元数据/IO错误不冒充无命中。
- Cordis 官方四能力由 [library 路由](../../../../skills/library/cordis-plugin-development/SKILL.md)定位；官方正文、参考和模板不打入本内核。需要检视与管理工具时分别激活当前摘要中的 cordis_inspect/plugin。
- Office 优先宿主 office 及子技能；历史 Node 资产保留在 library，不承诺停用目录或文件存在就可运行。Qoder 派生 agents 是提示资产，不是注册代理。
- 记忆定向查询，认证失败保留缺口，不改凭据、不全读图。检查点/经验库是私有派生数据，不进入分享包；恢复不提供新授权。
- jizhi_context / jizhi_experience 的公开参数为一个 request JSON 字符串；内部动作按各自[检查点](../../../../skills/core/context-checkpoint/SKILL.md)与[经验](../../../../skills/core/experience-loop/SKILL.md)契约严格校验，不补无关键。宿主 Goal 参数契约独立，不能用本包适配代替修宿主。
- 规则变更做分层检查；实现做正反回归；插件/预设做真实加载；界面做交互与截图；交付包重建、解压运行。源码 hooks、MCP示例与兼容插件存在不代表已经注册。
- 对话任务自测、故障定位与交付核对统一复用 [verify-before-claim 自适应闭环](../../../../skills/core/verify-before-claim/references/task-selftest.md)：风险分流、竞争假设和最小探针驱动结果契约、证据分层、变量隔离、正负对照及最小修复／回归，不机械跑满六项。只读账本不执行动作、不认证证据或模型质量；不新增常驻裁判或同域技能。
- 安装/移除只用 plugin_manager，不覆盖用户配置或恢复整份旧快照；旧 --apply 入口继续拒绝。需要重启时报告待验，不停本实例。

[包说明](../../../../README.md) · [恢复指南](../../../../RESTORE.md)

## 模型选择与任务组织

当前主模型按完整请求、已有授权和最小现场证据判断 USE/SKIP/ASK/NEEDS_FACTS；关键词/评分只召回候选，不自动启用、安装或授权，SKIP不删必要门禁。详见[能力选择与冲突](../../../../skills/core/skill-router/references/capability-selection.md)。长/复杂任务沿已有 VibeCoding 文档和分段验收推进，提示词优化和并行写域复用[vibe-coding](../../../../skills/core/vibe-coding/SKILL.md)。
