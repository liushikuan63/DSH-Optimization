# Windows 跨 Shell 诊断

仅在项目需要 Git Bash 调 Windows 程序、跨 PowerShell 版本，或遇到参数、编码、退出码异常时读取。不把外部机器的路径、版本、码页和宿主行为当成本机默认。

## 先确认实际解释器

当前调用中读取 `$PSVersionTable.PSEdition` 与 `$PSVersionTable.PSVersion`，并核对实际可执行文件路径。工具名称不等于底层解释器身份；Git Bash 与 WSL Bash 也不能互换。优先沿用项目工具链，不为诊断调整全局 PATH、系统代码页或代理。

## 参数在边界两侧都要验证

- 优先在 PowerShell 中使用原生参数数组、LiteralPath 和文件参数。复杂跨 Shell 脚本先保存到当前任务 work 目录，再通过明确的解释器加 `-File` 调用，减少多层字符串展开。
- Git Bash/MSYS 调原生程序时，`/groups` 等参数可能被当作路径转换；转换发生在原生子程序启动前，等子程序内部设置环境变量已来不及。用只输出 argv 的自有小程序做对照；确需保留参数时，对单次调用设置 `MSYS2_ARG_CONV_EXCL`，必要时限定前缀。
- 排除转换也会影响原本需要转换的路径。应先用 `cygpath -w` 等得到目标程序所需的 Windows 路径，再传参；不全局禁止转换，也不普遍把 `/` 改成 `//`。
- 不将 `shell: false` 或参数数组直接视为完整保真证据。包装器仍可能绕过 Windows 参数引用；不要在普通包装器里无依据启用 `windowsVerbatimArguments: true`。用含空格、引号和末尾反斜杠的自有样例核对收到的 argv。

## 脚本编码与输出编码分开核实

| 场景 | 处理 |
|---|---|
| Windows PowerShell 5.1 读取含非 ASCII 的无 BOM 脚本 | 可能按 ANSI 解释；使用与目标解释器兼容的编码，如 UTF-8 BOM；不要因此改动无关文件 |
| 5.1 的字符串 `>` / `Out-File` 默认输出 | 默认 UTF-16LE；回读首字节，不能按 UTF-8 强行解释 |
| PowerShell 7 的普通文本输出 | 通常使用 UTF-8 无 BOM；原生命令重定向须另核，不能套用字符串输出结论 |
| 原生程序 stdout/stderr | 保留原始字节，分别核查 BOM、程序编码与实际输出；纯 ASCII 成功不能证明非 ASCII 的编码 |

需要 UTF-8 文件时显式选择目标版本支持的写法。严格 UTF-8 解码失败不自动证明是 GBK；保留原始证据，确认程序和码页后再转换。不要把两路输出先拼字节再猜一种编码。

## 真实退出码与业务成功分开核实

同时核对子程序退出码、包装器自身退出码及业务结果。日志打印 `EXIT=7` 不能代替进程实际返回 7；`-File` 也不保证脚本里的所有错误都会使进程非零退出。

- PowerShell 的非终止错误可以在进程返回 0 时出现。对必要步骤使用适当的 Stop/try/catch 和明确结果断言；外部程序执行后立即保存 `$LASTEXITCODE`，不让后续命令覆盖。
- 不只靠搜索 `Error`、空 stderr 或成功提示判绿；这些都可能误判。保留错误流和退出码，再按实际预期值核验。
- 新包装器至少验证三态：正常输入、明确非零退出、输入或解析失败。参数含空格/引号时增加 argv 对照。测试只写自有目录，不用用户数据、注册表、服务或前台窗口作探针。

## 来源与验证边界

方法参考用户提供的 dsh优化-1.0.0.zip 中 windows-powershell-from-gitbash 与 windows-gitbash-command-safety，2026-10-24 独立整理；未移植其脚本、偏好和授权。原 ZIP SHA256：`0FD3AAF625932ACBA031BC3FFC6863F7267113BC858495FA02AF8BFA75E197D8`。

本次隔离探针验证了 5.1/7 的解释器身份、字符串重定向字节差异、Git Bash 路径转换、非终止错误仍退 0，以及两个原包装器的退出码和参数保真问题。具体机器版本仅在任务验收中记录，不固化为要求。未做生产项目、服务变更或 GUI 验收。

参考官方说明：[PowerShell 字符编码](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding)、[MSYS2 路径和参数转换](https://www.msys2.org/docs/filesystem-paths/)。
