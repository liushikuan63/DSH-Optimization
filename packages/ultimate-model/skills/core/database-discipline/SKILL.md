---
name: database-discipline
description: 跨数据库通用纪律与各库要点——改数据前先 SELECT 查证影响面、破坏性 SQL 禁令、绑定变量防注入、连接池不新建连接、改动前后量级对比；含 PostgreSQL/瀚高、MySQL、Oracle、MongoDB、Redis 的表设计/索引/事务/迁移要点与 Oracle→PG 方言映射。涉及库表设计、SQL 编写、索引优化、连接配置、数据迁移或慢查询排查时加载。
whenToUse: 任务涉及数据库或缓存的模型设计、查询编写、索引优化、连接池配置、数据迁移、慢查询与锁排查时。
---

# 数据库与缓存纪律

**分层口径**：本技能放**跨库通用**的纪律与各库要点；**本仓专属**的方言分支、状态口径、命名陷阱在项目 `AGENTS.md`
与 `项目 AGENTS.md 指向的技能` 里，不在此重复。两者冲突时以项目侧为准。

来源：Qoder 侧 `rules/databases.md`，2026-09-20 迁移为 DSH 技能。

## 一、跨库通用纪律（四条，缺一不可）

| # | 纪律 | 可失败判据 |
|---|---|---|
| 1 | **改数据前先 `SELECT` 查证影响面** | 先给出预期影响行数，再给出执行后实际行数，两者对得上 |
| 2 | **破坏性 SQL 绝对禁止**（`DROP` / `TRUNCATE` / 无条件 `DELETE`/`UPDATE`） | 守卫会硬拦（`pre-tool-guard.ps1`）；确需 DDL 要先备份 + 给回滚语句 + 用户确认 |
| 3 | **一律用绑定变量 / 预编译**（`?` 或 `:name`），禁止拼接 SQL | 代码里搜不到把参数直接插进 SQL 字符串的写法 |
| 4 | **一律经连接池**，不每次请求新建连接 | 连接池参数（最大连接数 / 超时 / 空闲回收）有明确取值与理由 |

**验收**：数据相关改动要给出**改动前后的量级对比**（行数 / 耗时 / 计划）、**一条属于本轮的判据**、以及**清理方案**。

## 二、只读边界（本机现状）

- 本机已配的数据库 MCP（`dbhub`，含 `hicon` / `guanyun-169` / `guanyun-50`）是**只读**的：
  可用来查结构与验影响面，**不能用来改数据**。
- 需要写库时**按库分档**：**共享 / 生产库**走受控通道（应用接口 / 人工执行）并先给影响面与回滚；**本机 / 已授权的隔离开发库**先用 `SELECT` 查证影响面、备好回滚语句即可直接执行，汇报附改动前后的量级读数；
  **连接信息复用既有配置，不要把口令抄进新的文件、日志或汇报**。

## 三、PostgreSQL / 瀚高（HighGo）

瀚高基于 PostgreSQL，规则通用；特有差异单独标注。

- **表设计**：金额等精确小数用 `NUMERIC`（不用 `FLOAT/REAL`）；时间戳用 `TIMESTAMPTZ`；大文本用 `TEXT` 不限 `VARCHAR(n)`；
  枚举用 `VARCHAR` + `CHECK` 或独立表，**不用** PG 原生 `ENUM` 类型（迁移困难）。
- **索引**：复合索引遵循最左前缀；高频 JSONB 查询用 GIN；全文检索用 `tsvector` + GIN；大表精确匹配可考虑 `HASH`；
  定期 `REINDEX` 与 `VACUUM ANALYZE`。
- **查询**：`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` 看**实际**计划；警惕 `SELECT *`、隐式类型转换导致索引失效、`OR` 拆索引；
  分页用 keyset（`WHERE id > ?`）替代大 `OFFSET`；大表 `COUNT(*)` 走 `pg_class.reltuples` 估算或维护计数表。
- **事务与锁**：长事务及时提交，避免 hold 行锁 / 阻碍 VACUUM；`SELECT ... FOR UPDATE` 慎用，优先乐观锁（`version` 字段）；
  死锁排查用 `pg_stat_activity` + `pg_locks`。
- **连接**：池大小 ≈ CPU 核数 × 2 + 磁盘数；配好 `connectionTimeout` / `idleTimeout` / `maxLifetime`。
- **瀚高特有**：JDBC 驱动 `com.highgo.jdbc.Driver`（或兼容 `org.postgresql.Driver`）；
  **`connection-init-sqls` 在 YAML 里必须用列表格式，不用分号拼接**；部分版本对 `bytea` 编码与 `interval` 运算有差异，改动前先测。
- **迁移**：DDL 变更必须可回滚（`ALTER ... ADD` 同时备 `DROP`）；大表加列用 `ADD COLUMN ... DEFAULT NULL` 再异步回填
  （PG 11+ 带 `DEFAULT` 的加列已是元数据操作，不再锁表重写）。

## 四、MySQL

- **表设计**：主键用自增 `BIGINT`（**不用 UUID 做聚簇键**，避免页分裂）；字符集统一 `utf8mb4`（不是 `utf8`）；
  金额用 `DECIMAL(18,2)`；时间字段按业务选 `DATETIME`（业务时区）或 `TIMESTAMP`（UTC）。
- **索引**：InnoDB 二级索引隐式含主键列，主键过长会拖慢所有二级索引；优先覆盖索引（不回表）；前缀索引省空间但**丧失排序能力**。
- **查询**：`EXPLAIN` 看 `type`（至少 `ref`）与 `Extra`（避免 `Using filesort` / `Using temporary`）；
  大偏移 `LIMIT` 用延迟关联（先取 id 再 JOIN）。
- **事务**：行锁基于索引，**无索引条件退化为表锁**；批量插入显式 `BEGIN/COMMIT`；默认 `REPEATABLE READ`，幻读由 gap lock 部分解决而非完全。
- **运维**：大表 DDL 用 `pt-online-schema-change` / `gh-ost`（原生 `ALTER` 会锁表）；开慢查询日志并定期分析。

## 五、Oracle

- **SQL 兼容**：字符串拼接用 `||`（`CONCAT()` 只收两参）；**空串等于 `NULL`**（`'' IS NULL` 为真）；
  日期字面量用 `TO_DATE('2026-01-01','YYYY-MM-DD')`；分页用 `OFFSET ... FETCH NEXT ... ROWS ONLY`（12c+）或 `ROWNUM` 嵌套。
- **性能**：绑定变量防硬解析；计划用 `EXPLAIN PLAN FOR` + `DBMS_XPLAN.DISPLAY`；统计信息过期会让优化器选错计划，定期 `DBMS_STATS.GATHER_TABLE_STATS`。
- **序列**：`SEQUENCE` + 触发器（旧版）或 `IDENTITY`（12c+）；`CACHE` 大小影响 RAC 下的序列间隙。

## 六、MongoDB 与 Redis

- **MongoDB**：先定文档模型再写查询，明确 embed vs reference；警惕无界数组、索引爆炸、16MB 上限；
  查询必须能命中索引，优化前先看 `explain` 的 `executionStats`；单例客户端 + 连接池；schema 变更要有迁移路径。
- **Redis**：键命名统一 `业务:对象:标识`；**非持久语义的缓存键必须设 TTL**；
  **禁止**在大键空间用 `KEYS` / `SMEMBERS` / `HGETALL`，改用 `SCAN` 系列；缓存要有明确失效策略与正确性边界；连接复用。

## 七、Oracle → PG 迁移映射

| Oracle | PostgreSQL |
|---|---|
| `NVL` | `COALESCE` |
| `DECODE` | `CASE WHEN` |
| `SYSDATE` | `NOW()` |
| `ROWNUM` | `LIMIT` |
| `(+)` 外连接 | `LEFT JOIN` |

**反向注意**：瀚高跑在 **Oracle 兼容模式**下，所以"postgres" 分支里 `trunc(sysdate-n)`、`dual`、`instr` 仍可用——
本仓的方言分支写法见项目 `AGENTS.md` §三与 `项目 AGENTS.md 指向的技能`，不要按纯 PG 习惯改掉。

---

*迁移来源：`~/.qoder/rules/databases.md`（2026-09-20）。原文里点名的各库专用技能（`postgresql-*` / `mysql` / `db` / `mongodb-*` / `redis-*`）尚未装到 DSH，需要时按 `feedback-dependency-verification` 核验来源后再装。*

---

> 来源：Qoder `rules/databases.md` 的「迁移设计与验证」/「大表迁移」/「跨 schema」+ `rules/multi-schema.md`（2026-10-13 补节）。

## 八、迁移设计与验证（写 / 评审迁移时，六条）

1. **不改写已执行的版本化迁移**（可能受校验管理）——按项目工具**新增修正迁移**。
2. 列改名 / 拆分 / 类型变化走「**扩展 → 兼容读写 → 分批回填 → 核验 → 切换 → 收缩**」；旧客户端还在用时别急着删字段。
3. **"新增 nullable 列"不叫无锁**——仍可能取元数据 / 表锁；`DEFAULT` / `NOT NULL` / 索引 / DDL 事务行为**依引擎与版本判断**（PG `CONCURRENTLY` 有事务限制、失败留 invalid 索引）。执行前查**目标锁定版本**的官方文档（`current` 页 ≠ 项目锁定版本）。
4. 回填用**稳定键 + 有界批次 + 恢复位置**，并验证**重跑不会覆盖新写入**。
5. 恢复计划分三层：**应用回退 / schema 恢复 / 数据恢复**；删列或有损转换**不能靠 DOWN 文件保证恢复**。
6. 在已授权的隔离库或 fixture 上验证迁移链、新旧代码兼容与可逆性；**准备迁移文件 ≠ 批准执行生产变更**。

## 九、大表迁移与跨 schema 权威源

- **大表迁移 / 批量写要分批且可续跑**：按主键区间或时间窗分批、**进度落盘**、支持暂停续跑；迁移前备份，改完核对**行数与抽样内容**。
- **跨 schema 一律显式 `schema.table`**，不依赖 `search_path`（`currentSchema` 会覆盖 `search_path`）；不带 schema 会报 `relation "xxx" does not exist`。
- **多 schema 同名表先识别权威源**（源表 vs 副本表）：副本表可能是**漂移的陈旧数据**，不能当真值；写路径确认**实际落库的表**；只读路径若接到副本表，结论必须标注「**来自副本 / 快照**」。
