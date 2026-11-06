---
name: systemd-java-service-centos7
description: 在 CentOS 7（systemd 219）上为 Java 微服务创建 systemd 开机自启加崩溃自重启的完整流程，包括 service 文件编写（bash -c 包裹日志重定向，绕过 append 不支持的陷阱）、一键配置移除脚本、daemon-reload 加 enable 加 verify。触发关键词：systemd、CentOS 7、开机自启、崩溃重启、java service、systemctl、StandardOutput append 不支持、Failed to parse output specifier。注意：本技能面向 CentOS 7 服务器；本机（DSH 宿主）是 Windows，所有命令须在服务器侧执行。
---

# CentOS 7 systemd Java 服务自启动配置

## 核心陷阱（必读）

systemd 219（CentOS 7 默认版本）不支持 `StandardOutput=append:` 指令。

错误现象：

```
systemd[1]: Failed to parse output specifier, ignoring: append:logs/console.log
```

`append:` 在 systemd 232+ 才引入。CentOS 7 的 219 版本遇到此指令会静默忽略，日志不会被写入文件。

解决方案：用 `bash -c` 包裹启动命令，在 shell 层完成日志重定向：

```ini
ExecStart=/bin/bash -c "exec java -Xms256m -Xmx512m -jar target/app.jar --spring.profiles.active=prod >> logs/console.log 2>&1"
```

## Service 文件模板

```ini
[Unit]
Description=服务描述
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=服务的工作目录
ExecStart=/bin/bash -c "exec java JVM参数 -jar jar路径 Spring参数 >> logs/console.log 2>&1"
ExecStop=/bin/kill -TERM $MAINPID
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

关键字段说明：

- `ExecStart` 必须用 `bash -c` 加 `exec` 包裹，`exec` 确保 java 成为 bash 的子进程，`kill -TERM $MAINPID` 才能正确停止
- `Restart=on-failure`：进程非零退出或被信号杀死时自动重启
- `RestartSec=10`：重启间隔 10 秒，避免快速重启循环
- `WorkingDirectory`：日志相对路径 `logs/console.log` 基于此目录

## 操作步骤

1. 确认 systemd 版本：`systemctl --version | head -1`（应为 systemd 219）
2. 确认现有进程状态：`ps aux | grep java` 和 `ss -tlnp | grep 端口`
3. 创建 service 文件：写入 `/etc/systemd/system/服务名.service`
4. 重载配置：`systemctl daemon-reload`
5. 启用自启动：`systemctl enable 服务名`（不自动 start，避免与现有手动进程冲突）
6. 验证语法：`systemd-analyze verify /etc/systemd/system/服务名.service`（无报错只等于**语法**通过——既不证 `enable` 成功，也不证 `Restart` 会生效）
7. 按可失败判据验收（第 6 步一条都不覆盖，以下全为只读）：
   - `systemctl is-enabled 服务名` 必须回 `enabled` —— 这才证明开机自启真的挂上了；
   - `systemctl show -p Restart -p RestartUSec 服务名` 必须回 `Restart=on-failure`、`RestartUSec=10s` —— 这才证明崩溃自重启配置真的生效；
   - 可选端到端：`kill -9 <MainPID>` 后 `systemctl is-active 服务名` 回 `active` 且 `systemctl show -p MainPID 服务名` 换新 PID —— **需停机 / 杀进程，交用户本人执行**（给出命令与预期输出，拿到回执再判）。
8. 切换管理权（可选）：如需让 systemd 接管已运行的手动进程，先停掉手动进程再 `systemctl start 服务名`

## 一键脚本模板

脚本支持三种模式：默认创建、`--remove` 移除、`--verify` 验证。

核心逻辑：

```bash
#!/bin/bash
set -e
ACTION=${1:---setup}

setup_service() {
  local name=$1 workdir=$2 jar=$3 jvm_args=$4 spring_args=$5
  cat > /etc/systemd/system/${name}.service <<UNIT
[Unit]
Description=${name} Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${workdir}
ExecStart=/bin/bash -c "exec java ${jvm_args} -jar ${jar} ${spring_args} >> logs/console.log 2>&1"
ExecStop=/bin/kill -TERM \$MAINPID
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT
  echo "[OK] ${name}.service"
}

if [ "$ACTION" = "--remove" ]; then
  # 遍历服务列表，disable + rm service 文件 + daemon-reload
  echo "已移除服务"
elif [ "$ACTION" = "--verify" ]; then
  # 遍历服务列表，systemd-analyze verify + systemctl status
  echo "验证完成"
else
  # 调用 setup_service 为每个服务创建文件
  # systemctl daemon-reload + enable
  echo "配置完成，服务已设置开机自启动"
fi
```

## 管理命令速查

| 操作 | 命令 |
|------|------|
| 查看状态 | `systemctl status 服务名` |
| 启动 | `systemctl start 服务名` |
| 停止 | `systemctl stop 服务名` |
| 重启 | `systemctl restart 服务名` |
| 查看全部 | `systemctl list-units '前缀-*'` |
| 验证语法 | `systemd-analyze verify /etc/systemd/system/服务名.service` |
| 查看日志 | `journalctl -u 服务名 -f` |

## 注意事项

- **红线（只落在会动到在跑服务的动作上）**：`systemctl enable` / `start` / `stop` / `restart` 等会改变服务状态、以及任何会影响在跑服务的动作，属 `~/.dsh/AGENTS.md` §三「核心服务禁动」——生产 / 核心服务先给方案与回滚步骤，经确认再动手。**写 unit 文件（纯新增，删文件 + `daemon-reload` 即回滚）、`daemon-reload`、`systemd-analyze verify` 这类纯新增 / 只读语法检查不设确认门，可直接执行**。
- 本技能面向 CentOS 7 服务器侧；DSH 宿主本机是 Windows。**命令的落地二选一**：① **有 SSH 通道就直接跑**（`ssh <server> '<命令>'`，逐条回读判据）；② **无通道、或该条需停机** 就整理成**可整段复制的命令 + 预期输出 + 回滚**交用户在其终端执行，用户回执实际输出后再判读。
- 已手动 `nohup java ... &` 启动的进程不受 systemd 管理；要让 systemd 接管，必须先 kill 手动进程再 `systemctl start`
- `systemctl enable` 只设置开机自启，不会立即启动服务；需要立即启动用 `systemctl start` 或 `systemctl enable --now`
- 多个服务有依赖关系时（如 agent 依赖 agent-tcp），用 `After=` 和 `Requires=` 声明
- 此 Skill 仅适用于 CentOS 7 / systemd 219；systemd 232+ 可直接用 `StandardOutput=append:` 无需 bash 包裹
