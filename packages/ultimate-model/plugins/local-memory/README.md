# 本地项目知识 / Local Project Knowledge

本地工作区知识页及透明文本检索。复用现有包独立启用，不需要远端账号、embedding、额外数据库或第三方依赖。

## 分工与边界
- 知识层保存显式提交的 component/concept/convention/decision/initiative/lesson/note；不自动采集整仓、Git全历史、原始工具参数或会话全文。
- checkpoint继续负责会话恢复，experience继续保存派发元数据/待审候选，MCP memory继续提供图谱。本工具不绕过它们的写入预算，也不把它们冒充知识页。
- 存储记录标注 `trust=unverified-submitter-claim`；来源、checksum和修订号不等于业务事实认证，不提供权限或自动续跑授权。
- 每个真实Agent原始session cwd使用自己的 `.dsh/local-memory/store-v1.json`；模型不能用参数指定路径、其他workspace/session或写权限。
- 新Host行默认disabled，经当前profile的管理器显式启用后才生效；不替换其他preset或默认跨项目检索。
- 工具自身不发起网络请求，但命中内容会作为工具结果进入当前选用模型的上下文；当前模型是否远端由既有模型服务决定。本功能不是离线LLM或数据绝对不出机承诺。
- 数据以本地明文文件保存，依工作区现有权限保护，不提供加密或同用户安全沙箱。提交正文可能随标准工具会话日志保留；forget不擦除这些日志。

## 工具
单一原生工具 `local_memory`，参数 `request` 是一个JSON字符串：

```json
{"action":"remember","title":"项目约定","body":"这里填写经授权、已脱敏的项目知识。","kind":"convention","tags":["约定"]}
```

```json
{"action":"search","query":"项目约定","limit":5}
```

```json
{"action":"read","id":"返回的规范页ID"}
```

- `health`：本地库是否存在、数量、限制与检索方法；不创建空库。
- `list`：可选kind/limit，仅元数据。
- `search`：query必填，可选kind/limit；NFKC、Unicode词和中文bigram加权词项命中，无embedding或云端合成；可能漏掉同义表达。
- `read`：id必填，返回正文和有界历史摘要；不存在与损坏/不可读分开。
- `remember`：新建不带id；纠错使用同id和当前expectedRevision，再提供title/body/kind/tags。旧revision冲突拒绝，不覆盖新变化。
- `forget`：id和当前expectedRevision必填，生成墓碑，检索不再命中；旧正文可能仍在有界修订历史中，**不是物理或安全擦除**。

## 当前实现安全上限（设计预算，非性能测量）
由 `LOCAL_MEMORY_LIMITS` 导出：body 16KiB、title 256B、tags最多12项/每项64B、最多256页（含墓碑）、历史3版、库1MiB、结果20条、snippet384B、query512B、单输出64KiB。可信测试选项只能调低；上限满拒写，不自动删事实、重置额度或占用经验库预算。

## 读写安全
- health/list/search/read为纯读，不mkdir、取写锁、持久索引、迁移、备份或修坏库。OS自身读访问时间不等于插件主动持久化。
- remember/forget要求真实sandboxPolicy可写、exact live Agent/Session、当前任务范围和同步事务授权回调；未知/只读拒绝。父Full不自动成为子代理私有知识写许可。
- 证据lease、current seq、policy和取消在事务内复验；插件卸载和Agent销毁中止未提交操作。已经完成的副作用不能因后到取消而保证撤回。
- 有文件checksum、大小/数量边界、独立scope、互斥锁、身份/链接检查和owned临时清理；不删除替换者，不递归清库，不自动抢旧锁。
- 对常见密钥、凭据赋值、私有地址/敏感路径做拒绝校验，但不是完备秘密扫描器。不要提交密码、token、私钥、内网地址、全文日志或未经确认的用户偏好。
- 自然语言只读兼容规则仅保守收窄，不是完备授权分类器；真实Host policy仍是机器边界。文件pathname检查不保证抵抗同权限恶意并发者的OS原子隔离。

## 状态不确定与回滚
若写操作后的lease释放/取消出现错误，先按页ID/标题读取核对，不自动重复remember；同页更新依expectedRevision防止静默覆盖。

停用仅用管理器精确row，不删除项目知识。删除/导出/跨库迁移数据不是停用的附带动作，需独立授权。升级后如需重启当前实例，由明确维护/独立handoff处理，不在会话内停自己。

本工作区目录只是装配与隔离测试源；最终运行文件位于既有包 `plugins/local-memory/`，最终policy薄转发至唯一共享门禁。安装／注册／真实工具验收分别记录；没有渲染截图时不声称管理页图标视觉验证通过。
