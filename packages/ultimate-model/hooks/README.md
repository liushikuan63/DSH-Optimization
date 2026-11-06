# 可选命令 hooks · 源码与证据分层

本包默认不注册旧进程桥、不写目标机hooks.json。磁盘存在不等于触发；本机既有桥是否在线需看本轮事件/退出码，历史心跳或脚本单跑不能代替。

| 入口 | 行为与边界 |
| --- | --- |
| lib.ps1 / queue-scope.ps1 | 有界输入、心跳/崩溃记录；session+cwd作用域以AND匹配，拒绝未绑定/畸形scope；内容戳不采用全局mtime |
| session-start.ps1 | 只读检查依赖，不隐式补丁/安装/重启；只注入本scope已授权可推进队列。其他项留原队列，不表示完成 |
| rules-reminder.ps1 | 从实际DSH_HOME/AGENTS.md唯一标记块取摘要，不维护第二份纪律 |
| stop-gate.ps1 | 仅本scope未完成项参与判定；保留阻塞过滤，不让别的会话改动重置自己的停滞计数 |
| pre-tool-guard.ps1 | 可选pwsh7+Node兼容入口，调用plugins/hook-guards-native/check.mjs同一判定核心；异常拒绝，不宣称与旧正则独立对齐 |
| rules-weekly-audit.ps1 | -Check只读；规则同时查行数/UTF-8字节与语义标记，技能用同一实时采集器；正常执行才写生成报告与兼容成功戳 |

原生单调守卫是新模式的执行前拒绝机制，不依赖旧桥的超时语义。进程hooks是可选诊断/接续层，不能作为无条件安全保证。

验收：tests/queue-scope.test.ps1覆盖双scope/AND/未绑定/阻塞/内容戳/单一规则摘要；Node守卫与CLI测试覆盖允许/拒绝和取消。真正桥在线、首次新会话触发与GUI尚须现场验证；未触发不得说已生效。

禁用沿既有Test-HookFlag或官方插件配置；不删除用户脚本，不改宿主源码。修改候选与自动生成经验都不能自行启用hooks或扩大权限。
