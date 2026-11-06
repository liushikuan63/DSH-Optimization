# Native scoped guard

单调 tools.guard＋effect/disposer；预设作用域注册，不通过短路 waterfall 放行。判断异常拒绝，legacy CLI复用同一核心。

后台规则不能用旧环境开关豁免；Shell指针、抢前台、SendInput/keybd_event注入拒绝。后台键盘能力走精确目标工具；不可达时说明，不以换通道绕过。

SQL逐语句、括号与常量布尔检查，只是有限预检，不是完整SQL解析器或数据库权限边界。

磁盘改动不表示当前内存更新。包默认只在jizhi内注册；宿主旧全局插件需另验。安装/真实运行状态以本轮证据为准，不以历史日志作证。

## 本轮实际工具覆盖

str_replace_editor 按实际 path+command 区分视图与写操作；凭据路径仍拒绝，整读大文件应分段（view_range 每次不超过200行）。明确递归删除按常见 bash/win_bash/PowerShell写法拒绝，不通过改写命令绕过；需要的维护仍须按当前授权给出具体范围、备份与恢复方案。普通编辑、任意脚本和所有SQL变体不属于完整语义安全证明。

foreground-policy.mjs 是纯代码；个人许可JSON绝不分发。默认无许可仍拒绝前台；许可必须绑定真人授权来源、会话/工作区、宿主与目标PID、窗口、驱动会话、动作、TTL和次数，取消立即拒绝。全局和预设看到同一次execution只消耗一次；不能由工具参数或引用文本伪造许可。
