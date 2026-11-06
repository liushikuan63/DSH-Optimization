# 可选通用工作流

`global-workflow.md` 为读取目标 home 的 AGENTS.md 的各模式提供通用任务契约：目标与完成条件、按需语义选择、长复杂任务的 VIBECODING 记录、分段验证、并行归属及现有改动保护。它沿用当前用户和项目授权，不注册 hook、不调用模型、不启动后台任务，也不改变默认 preset。

从可信来源取得完整仓库，并独立核对发行 ZIP SHA256。相对布局必须保持：

```text
scripts/install-workflow.mjs
overlays/global-workflow.md
overlays/README.md
packages/ultimate-model/scripts/metadata-transaction.mjs
```

在仓库根目录预演；`--home` 必须明确给出已存在的绝对目录，不读取 DSH_HOME 推断目标：

```text
node scripts/install-workflow.mjs --home "<DSH_HOME_ABSOLUTE_DIR>"
node scripts/install-workflow.mjs --home "<DSH_HOME_ABSOLUTE_DIR>" --apply
```

默认或显式 `--dry-run` 只读。输出仅含动作、字节数、哈希和路径，不回显个人规则正文。首次应用只在原始 AGENTS.md 字节后追加托管块；UTF-8 BOM、原文及混合换行保持原字节，新块采用对应换行。缺少 AGENTS.md 时可显式创建。

- `APPEND`：可应用的首次追加。应用前把完整原像作为随机命名的 `AGENTS.md.dsh-workflow-backup.*.bak` 永久备份留在该 home；原文件不存在时备份为空，回执注明 `originalExisted:false`。
- `KEEP`：已有精确相同块，不写文件、不追加备份。块外用户更新保持原样。
- `REVIEW_UPDATE`（退出码 3）：既有块不同、残缺或被本地修改，保持所有文件不变。首版不自动替换旧托管块。
- 参数错误退出 2；链接、只读、非 UTF-8、并发变化或事务错误退出 1。不要通过放宽权限、删锁或覆盖文件来强行继续。

应用使用冻结 UM6 中的 metadata-transaction helper。入口固定路径，先用 Node 内置模块校验 helper SHA256，再从已验证的精确字节载入；不接受外部 JavaScript 路径。未来 helper 改版需要独立审查并更新固定哈希，不能自动信任陌生副本。

备份先独立提交；随后 AGENTS 发布核对规划时的对象身份与内容。并发内容保留，发布失败由现有事务协议恢复。异常回执中的 `backup`、`stage`、`committed` 用于核对恢复状态；永久备份不因后一步失败而删除。需要回退时先比较当前块及块外新改动，不直接用整份旧备份覆盖用户的新内容。KEEP 不负责清理其他未完成事务。

是否已由现役 DSH 或新任务读取该 home 的规则，需要单独运行验证；文件已写不能替代模型采用证据。Windows 本轮隔离测试已覆盖，其他平台按目标环境验证。

回归入口（在仓库根）：

```text
node --test scripts/tests/workflow-overlay.test.mjs
```

可通过 `DSH_WORKFLOW_TEST_ROOT` 指定任务专用临时根。测试仅使用新建的合成 home，保留夹具供检查；不接触真实用户 home。`DSH_WORKFLOW_TEST_HELPER` 仅供独立测试树定位可信 helper，不是生产安装器参数。
