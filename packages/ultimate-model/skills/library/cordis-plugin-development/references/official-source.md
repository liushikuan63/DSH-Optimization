# 官方 Cordis 源的按需定位

这四项能力属于官方 `cordis`（创造）模式；本包只保存薄路由，不另存官方正文、参考、模板或包清单。

1. `jizhi_skill_search` 只返回元数据。命中四项路由且 Host Inspect 可用时，它按当前 Config 目录查询包目录，返回 `host.official` 的真实 SKILL.md；仍需 read 后才算读取。
2. 没有 Host 或查询尚未解析时，读取本地薄路由；需要检查工具时按当前目录摘要激活 `cordis_inspect`，再调用 `cordis_inspect_list`。
3. 从列表确认 Host Config provider 与 listConfigs 输入，按 `name=@deepseek-ai/dsh-agent-preset` 分页找真实 entry，再用该 entry 查询 `packageDir`。从该目录定位 `skills/<技能名>/SKILL.md`，不得猜作者盘符或复制缓存路径。
4. 官方技能中的 references/templates 以其实际目录为基准，只读当前任务需要的一项。包清单用官方参考继续定向检索，不全量载入。
5. 插件管理工具另属当前摘要中的 `plugin` 族；先激活再调用。激活不构成安装批准，仍执行官方权限和构建脚本门禁。

四项：`agent-experience`、`cordis-plugin-development`、`editing-cordis-compositions`、`cordis-composition-reference`。Host 无对应包、IO错误或取消要分别报告，不冒称能力已加载；不增加第二个 Host Inspect provider，不修改其他模式。
