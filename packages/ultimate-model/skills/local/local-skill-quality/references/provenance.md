# 来源与适配范围

2026-10-24 根据用户提供的 Qoder优化5.5.11.zip 评估并提炼方法。

- 原压缩包 SHA256：2FF472C7913E9E38F36C52878FB94EB58008B16020E478EBEF99AA40BBBD45A6。
- 主要方法来源：包内 skill-reference-integrity-audit、skill-description-route-cue-rewrite、skill-trim-with-capability-transfer。
- 本地实现：重新编写技能正文和 Python 引用检查器，不复制原脚本或长篇正文。所涉原技能未见独立明确许可，故不宣称它们采用 MIT 等开源许可。
- 差异：支持 Python、PowerShell、嵌套路径和中文名称；跳过行内链接语法示例；检查器故障与缺失引用使用不同退出码。不继承 Qoder 路径、Hooks、计数阈值或其他用户偏好。
- 文件存在性检查不替代真实命令执行或语义审查，描述检查不冒充宿主路由测试。

2026-10-24 根据用户纠正补充方法适配流程：进一步从 DSH 包的工具分页、事件恢复、重试与宿主契约案例提炼方法，用现有技能承接，不以平台不可移植为由搁置。DSH 包 SHA256：0FD3AAF625932ACBA031BC3FFC6863F7267113BC858495FA02AF8BFA75E197D8。独立改写且保留原授权边界；宿主插件没有安装。

技能结构与按需发现机制参考 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills)，于上述日期读取。实际宿主发现需另行验证。
