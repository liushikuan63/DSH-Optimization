---
name: java-spring
description: Java 与 Spring Boot 项目的开发规则——版本门禁（Java 8 禁用语法清单、Boot 2/3 的 javax/jakarta 不可混用）、多模块 Maven 依赖方向、构造器注入与分层职责、编译退出码必须进验收判据。仅在 Spring Boot 项目改 Java / pom / application 配置时加载。
whenToUse: 在 Spring Boot 项目里改 Java 代码、pom.xml / build.gradle、application*.yml/properties，或排查依赖与启动问题时。
---

# Java / Spring Boot 开发规则

> **适用范围（先看这条）**：本技能只适用于 **Spring Boot 项目**。
> 目标项目若**不是 Spring**（例如 JFinal / Velocity 手写路由 / ActiveRecord 一类框架），
> 请用该项目 `AGENTS.md` 指向的技能 + 项目 `AGENTS.md`，**不要套用本技能**。

来源：Qoder 侧 `rules/java-spring.md`，2026-09-20 迁移为 DSH 技能。

## 一、版本与兼容（先确认再写码）

| 前置确认 | 判据 |
|---|---|
| 改动的模块用哪个 Java 版本 | 先读该模块 `pom.xml`（本机同时维护 Java 8 与 Java 17 模块） |
| Boot 大版本 | 2.x 用 `javax.*`，3.x 用 `jakarta.*`；**混用必然编译或启动失败** |

**Java 8 模块禁用**：`var`、`record`、文本块、`sealed`、`switch` 表达式、`List.of()` / `Map.of()`、`Stream.toList()`。
判据：`mvn -q -pl <module> -am compile` 退出码为 0（`-source 8` 下这些语法直接报错）。

## 二、多模块 Maven

- **依赖方向只能向下**：`web → service → dao/domain`；禁止反向依赖与循环依赖。
  判据：`mvn -q dependency:tree` 里不出现反向边；或 `mvn -q -pl <module> -am compile` 能过（循环依赖会直接失败）。
- 新增跨模块依赖前，先确认父 POM 的 `dependencyManagement` 里有版本管理，**不要就地写版本号**。

## 三、依赖注入与分层

- **构造器注入优先**（依赖声明为 `final`），不用字段注入 `@Autowired`；可选协作者用 `ObjectProvider`。
- 分层职责：Controller 只做参数校验与编排；**业务逻辑在 Service；事务边界在 Service 层**。
- 统一异常处理走 `@RestControllerAdvice`，对外错误结构保持一致；**不把堆栈直接返回客户端**。

## 四、验证（本技能最容易放水的地方）

- 完成后跑 `mvn -q -pl <module> -am test`；**编译退出码必须作为验收判据的一部分**——
  `spring-boot:run` 会复用旧编译产物，**"编译红而启动绿"是假证据**。
- 启动验收要能证明两件事：打出 `Started Application` 的是**本轮自己起的进程**；请求打的是**本轮独占端口**。
  判据：启动日志里有本轮时间戳的 `Started`，且端口用 `--server.port=<非默认>` 独占。

## 五、反模式速查

| 反模式 | 正例 |
|---|---|
| Java 8 模块里写 `var` / `List.of()` | 显式类型 + `Arrays.asList` / `Collections.emptyList()` |
| 字段注入 `@Autowired` | 构造器注入 + `final` |
| 就地写版本号 | 写进父 POM `dependencyManagement` 再引用 |
| "启动成功所以编译没问题" | 报 `mvn compile` 退出码 + `Started` 日志 + 独占端口 |

---

*迁移来源：`~/.qoder/rules/java-spring.md`（2026-09-20）。原文点名但 DSH 未安装的 Spring 相关技能（`spring-boot-engineer` / `spring-boot-test-patterns` / `java-architect`）需要时按 `feedback-dependency-verification` 核验来源后再装。*

---

> 来源：Qoder `rules/java-spring.md` 的 AOP / SpringDoc / 运行期排障 / REST 契约 / MyBatis 各节 + `rules/external-jar.md` + `rules/infra-ops.md` 的时间戳三层（2026-10-13 补节）。

## 六、AOP（横切关注点）

- 只把**真正横切**的放切面（日志 / 审计 / 权限 / 缓存 / 事务），业务分支不进切面；切点用**注解锚定**（自定义注解 + `@annotation(...)`）或包名锚定，**不用**宽泛的 `execution(* *(..))`。
- **同类内部调用不走代理**——`this.method()` 上的 `@Transactional` / `@Cacheable` 不生效，要生效就拆到另一个 Bean。判据：断言目标行为**真的发生**（事务真回滚 / 缓存真命中），不是看注解在不在。
- `@Around` 必须保证 `proceed()` 被调用；短路要写明理由。

## 七、接口文档（SpringDoc OpenAPI）

- **artifact 按 Boot 大版本选**：3.x → `springdoc-openapi-starter-webmvc-ui`；2.x → `springdoc-openapi-ui`；版本交给父 POM 的 `dependencyManagement`，不就地写。
- 入参出参用注解补全（`@Operation` / `@Parameter` / DTO 的 `@Schema(description, example)`），**错误码与统一异常结构也要标**；生产按需关 UI（`springdoc.swagger-ui.enabled=false`）。
- **上线自检**：取一次 `/v3/api-docs`，断言**本轮新增的接口在里面**（按 path + method 找得到）。

## 八、运行期排障（按症状找，不静态反推）

| 症状 | 根因 → 做法 |
|---|---|
| "查不到数据 / 终端不在线 / 注册到错误 endpoint" | 一个模块多环境，**默认 profile 常指向另一个环境的库** → 启动**显式指定 profile**，日志 `The following profiles are active` 与 JDBC URL 一起核对 |
| 跨 fastjson 版本取嵌套对象恒为 null / 类型判断恒 false | 1.x 兼容包解析出的嵌套对象实为 `com.alibaba.fastjson2.JSONObject`，**只影响快路径**、极隐蔽 → 一律 `getJSONObject(key)` |
| ACK 超时 / 命令丢失 | `nioEventLoopGroup-*` 与 `agent-business-*` 是两条路 → 用**线程名**定位；修复方向是给显式超时预算，不是"重启试试" |
| 接收 path 的接口报 target file not found，curl 直连却正常 | `%2F` 字面量伪装 → 统一走"**编码兼容解码 + 穿越校验**"，不在每个接口各写一套 |
| 同一对象的「列表 / 查看 / 恢复 / 删除」口径不一致 | 多通道写入 OR / 归属校验各写各的 → 全通道复用同一判据；MyBatis-Plus 里 OR 与 AND 混用**显式加括号** |

## 九、REST 契约（新增 / 改接口时）

- **兼容边界＝已有消费者的行为**：不因上游推荐风格就改路由 / 返回结构 / 版本；**新增可选字段**比删字段、改类型、改 null 语义更易兼容；列出真实消费者。参数校验覆盖类型 / 长度 / 枚举 / 页大小 / 排序范围，排序键映射**服务端白名单**。
- **租户与资源范围来自可信认证上下文，不能由请求参数决定**。分页沿已有机制选 offset / cursor（cursor 需**稳定排序 + 唯一兜底**，明确筛选变化时的行为——"列表能返回"不代表翻页无遗漏）。
- 幂等键绑定**调用方 + 操作 + 请求内容**，覆盖并发首次请求 / 同键不同内容 / 结果复用；**不能靠前端禁用按钮**。**幂等状态要与业务提交可恢复一致**（避免业务已成功但结果未记录时再执行，或失败请求永久占用幂等键）；核对进程重启、键保留期与重复请求的恢复路径；旧客户端不提供幂等键时**不得承诺任意重试都能去重**。
- 状态码区分创建 / 异步受理 / 校验 / 认证 / 授权 / 冲突 / 限流；不暴露内部栈与敏感字段。

## 十、MyBatis 检查（映射 / 绑定 / 性能）

- 值一律 `#{...}` 绑定；`${...}` 是**文本替换**（动态列名 / 排序需服务端闭合映射）；多参数核对 `@Param` / XML `namespace.id` / `resultMap`。
- 动态 SQL 的**空集合与空过滤边界必须明确**——不能因条件被省略就 `update` / `delete` 全表；复杂连接查**行倍增与去重**，nested select 查 **N+1**，批处理查 flush 时机 / 部分失败 / 幂等 / **恢复位置**。
- **不因方法上写了 `@Transactional` 就宣称已回滚**（核对代理入口、自调用、异常传播、`rollbackFor`、多数据源、异步线程）；参数绑定 / 方言 / 事务回滚优先用**真实数据库集成测试**验证，H2 / mock 不能单独证明生产引擎行为。

## 十一、外部 jar 实体扩展

- 实体类在**外部共享 jar** 里时**不能在本项目内直接加字段**——会改 Feign 契约、影响所有引用模块；识别方法是看该类来自哪个 artifact（源码在仓内 vs 依赖 jar）。
- 在 jar 内 ⇒ 用**子类 / 扩展类**承载新增字段；注意序列化与反序列化契约、Mapper 映射与返回类型（**`HashMap` 自动透传，实体只能靠子类扩展**）。

## 十二、时间戳跨系统对齐（三层，缺一层就差 8 小时）

1. `java.sql.Timestamp` → `LocalDateTime` 输出**纯字符串**（别让 Jackson 按 UTC 序列化）；2. JVM `-Duser.timezone=Asia/Shanghai`；3. JDBC 会话 `SET TimeZone`。
