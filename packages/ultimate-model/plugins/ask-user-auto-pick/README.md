# 可选普通问题自动选择兼容插件

Ultimate Model不默认注册本插件。源码仅当DSH_ASK_USER_AUTO_PICK=1时启用；普通可逆偏好题必须满足timed语义、首选项推荐标记、整批可选且非审批等边界。

任何非空intent均跳过，skipIntent固定true；没有环境开关可将审批/计划题放行。超时/取消/推荐标签从来不是本人授权，自动结果不得作为破坏性动作依据。

没有新造ask_user_question.timeout字段。宿主当前schema仅允许questions时严格遵守；timed等待由实际预设/运行时契约决定。本包预设使用blocking，缺裁决时继续独立工作而不是自动批准。

tests/regressions.test.mjs包含普通正例、intent审批跳过、取消与超时边界。磁盘源码更新不代表原进程缓存已热替换，真实加载另验。
