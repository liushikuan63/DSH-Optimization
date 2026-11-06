---
name: infra-ops
description: 中间件与反向代理的规则——nginx 配置结构与 proxy_pass 斜杠语义、改配置先备份并 nginx -t 再 reload；Nacos 服务注册与配置中心（命名空间隔离、生产必须外部 MySQL）；RabbitMQ/RocketMQ/Kafka/ActiveMQ 的可靠性配置与堆积排查；以及"改配置先备份、生产 / 共享环境改动先审核、核心服务红线、端到端验证"四条通用纪律。涉及 nginx / Nacos / MQ 时加载。
whenToUse: 任务涉及 nginx 反向代理或配置、Nacos 注册与配置中心、消息队列（RabbitMQ / RocketMQ / Kafka / ActiveMQ）的使用与排查、或生产环境中间件变更时。
---

# 中间件规则（nginx / Nacos / MQ）

来源：Qoder 侧 `rules/infra-ops.md`，2026-09-20 迁移为 DSH 技能。

## 一、通用纪律（四条，优先于任何技术细节）

| # | 纪律 | 判据 |
|---|---|---|
| 1 | **改配置前先备份** | 存在带日期的 `.bak`；能按备份回滚 |
| 2 | **生产 / 共享环境改动先给用户审核** | 生产 / 共享环境：先展示将执行的配置与命令，确认后再动手；**本地 / 开发机**改动 + 先备份 + `nginx -t` 等预检通过则**直接执行**，汇报附差异 |
| 3 | **核心服务红线** | 生产 nginx / Nacos / MQ 的启停与配置变更是高危；必须先给影响面与回滚方案 |
| 4 | **端到端验证** | 改动后用**实际请求 / 实际消息**走通完整链路；**只看控制台状态不算** |

另外：排查前**先确认实际监听端口**（`ss -tlnp` / `netstat`），不凭默认端口假设。

## 二、nginx

- **配置结构**：`main → events → http → server → location`；站点配置用 `include conf.d/*.conf` 拆分。
  流程：**先备份** → 改 → `nginx -t` 测语法 → `nginx -s reload`（**顺序不可颠倒**）。
- **反向代理的斜杠语义（最高频的坑）**：
  - `proxy_pass http://backend/`（**带尾斜杠**）→ 剥离 `location` 前缀后再拼；
  - `proxy_pass http://backend`（**不带**）→ 原样传递 `location` 路径。
  判据：请求 `location` 路径后，后端收到的 URI 与预期一致（看后端 access log / 返回内容）。
- 必须设 `proxy_set_header Host $host`、`X-Real-IP`、`X-Forwarded-For`，否则后端拿不到真实客户端 IP。
- **负载均衡**：默认轮询；`ip_hash` 保持会话亲和（但后端扩缩容会重分布）；`least_conn` 适合长连接；
  健康检查用 `max_fails` + `fail_timeout`（开源版）。
- **SSL/TLS**：证书与私钥配对；`ssl_protocols TLSv1.2 TLSv1.3`（禁用 1.0/1.1）；
  `ssl_ciphers` 优先 `ECDHE` 系列；HTTP/2 用 `http2` 指令（1.25+）或 `listen 443 ssl http2`（旧版）。
- **性能**：`worker_processes auto`；`worker_connections` 按并发调；静态资源 `sendfile on` + `tcp_nopush on`；
  gzip 压缩 `text/plain text/css application/json application/javascript`；大文件用 `X-Accel-Redirect` 交给 nginx 发送。
- **排查**：`nginx -t` 查语法；`error.log` 看具体错误（`permission denied` → SELinux / 文件权限；
  `upstream timed out` → 后端慢或超时太短）；`access.log` 配 `awk` 统计高频 IP / 路径。

## 三、Nacos（Spring Cloud Alibaba）

- **双重角色**：服务注册中心（替代 Eureka/Consul）+ 配置中心（替代 Spring Cloud Config / Apollo）。
- **服务注册**：`spring-cloud-starter-alibaba-nacos-discovery`；`spring.cloud.nacos.discovery.server-addr`；
  服务名默认取 `spring.application.name`；消费者用 `@LoadBalanced` RestTemplate 或 OpenFeign 按服务名调用。
- **配置中心**：`spring-cloud-starter-alibaba-nacos-config`；在 `bootstrap.yml`（或 Boot 2.4+ 的
  `spring.config.import: nacos:`）配 `server-addr` / `namespace` / `group` / `dataId`；
  Data ID 规则 `${prefix}-${spring.profile.active}.${file-extension}`。
- **命名空间隔离**：dev / test / prod 用不同 Namespace ID；配置变更先"灰度发布"推单台验证再全量。
- **持久化**：**生产必须配外部 MySQL**（内嵌 Derby 不支持集群）；`conf/nacos-mysql.sql` 初始化表结构。
- **排查顺序**：服务调不通 → ① 控制台确认注册成功（有实例）② 检查命名空间一致 ③ 检查网络 / 防火墙；
  配置不生效 → 检查 `bootstrap.yml` 是否被加载（Boot 2.4+ 需额外引 `spring-cloud-starter-bootstrap`）。

## 四、消息队列

### RabbitMQ（AMQP）

- 链路：Producer → Exchange（fanout/direct/topic/headers）→ Binding → Queue → Consumer。
- **不丢消息要两端都开**：publisher confirm + consumer ack。
- 集成：`spring-boot-starter-amqp`；`RabbitTemplate` 发、`@RabbitListener` 收；声明式绑定用 `@Bean`；
  序列化推荐 JSON（`Jackson2JsonMessageConverter`）。
- **可靠性**：队列 `durable=true`；消息 `deliveryMode=PERSISTENT`；消费者手动 ack（`acknowledge-mode: manual`）；
  死信队列（DLX）兜处理失败的消息。
- **排查**：控制台 `:15672` 看队列深度 / 消费者数 / 速率；堆积 → 消费者异常退出或处理太慢；
  `Unroutable` → 检查 Exchange 类型与 routing key 匹配。

### RocketMQ

- 适用：高吞吐（十万级 TPS）、事务消息、延迟消息、消息回溯。
- 概念：NameServer（路由）+ Broker（存储）+ Producer + Consumer Group；集群消费（组内一条只被一个消费者处理）vs 广播消费。
- 集成：`rocketmq-spring-boot-starter`；`@RocketMQMessageListener` / `RocketMQTemplate`。
- 排查：控制台看消费进度（`ConsumerProgress`）与消息轨迹；堆积查消费者在线数与消费 TPS。

### Kafka

- 适用：日志收集、流处理、事件溯源；百万级 TPS；**消息按 partition 有序**。
- 概念：Broker → Topic → Partition → Consumer Group；offset 按 partition 独立维护；rebalance 时短暂停消费。
- 集成：`spring-kafka`；`@KafkaListener` / `KafkaTemplate`。
- 排查：`kafka-consumer-groups.sh --describe` 看 **lag**；延迟先看 **partition 分布是否均匀**（热点 partition 拖慢整组）。

### ActiveMQ

- 两种形态：Classic（老版，JMX 管理）与 **Artemis**（新版，兼容 AMQP/MQTT/OpenWire）；**新项目优先 Artemis**。
- 集成：`spring-boot-starter-activemq`；`JmsTemplate` / `@JmsListener`；连接工厂 `ActiveMQConnectionFactory`（Classic）
  或 `PooledConnectionFactory`；序列化用 `JacksonJmsMessageConverter`（**不要**用 Java 序列化跨语言）。
- 可靠性：持久化消息 + 手动确认（`CLIENT_ACKNOWLEDGE` 或 `SESSION_TRANSACTED`）；
  死信队列 `ActiveMQ.DLQ`；`RedeliveryPolicy` 控重试次数与间隔。
- 排查：Classic 控制台 `:8161/admin` 看队列深度 / 连接存活；Artemis 用 `artemis producer/consumer` CLI 压测。

> **项目侧对照**：若目标项目的配置文件里有 `activemq.*` 一类配置项且联调依赖 MQ 打通——
> 碰 MQ 问题时同时看该项目自己的 `AGENTS.md`（上线核对项通常含 `activemq.*`）。

## 五、反模式速查

| 反模式 | 正例 |
|---|---|
| 改 nginx 直接 `reload` | 先备份 → 改 → `nginx -t` → `reload` |
| 以为 `proxy_pass` 带不带斜杠一样 | 按上面语义判断，并用真实请求验证后端收到的 URI |
| "控制台显示队列为空所以正常" | 用实际消息走通生产→消费→确认全链路 |
| Nacos 生产用内嵌 Derby | 配外部 MySQL（集群前提） |
| Kafka 只看总 lag | 先看 partition 分布是否均匀 |

---

*迁移来源：`~/.qoder/rules/infra-ops.md`（2026-09-20）。原文点名但 DSH 未安装的技能（`nginx-configuration` / `spring-cloud-alibaba`）需要时按 `feedback-dependency-verification` 核验后再装。*

---

> 来源：Qoder `rules/infra-ops.md` 的「nginx 按 Host 选 server 块」一节（2026-10-13 补节）。

## 六、nginx 按 Host 选 server 块（验收误判高发）

- 服务器上 `curl http://127.0.0.1/...` 命中的是**默认 server 块**——403 / 404 **不代表服务不可用**，只表示"没匹配到你要的那个 server 块"。
- 校验用**外部真实 IP**，或 `curl -H 'Host: <真实域名/IP>'`；**部署脚本别拿本机回环的返回码当发布失败判据**。
- `reload` **不换 master**：判断配置生效看 **worker 启动时间**（如 `ps -o lstart -p <worker pid>`），不是看 reload 命令回显。
