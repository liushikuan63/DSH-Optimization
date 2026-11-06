---
name: office-docs
description: 不依赖 Python 用 Node 读写 Excel（.xlsx/.csv）与 Word（.docx）——读表格转 markdown/JSON（支持按范围/行数截断、列工作表、读公式原文）、按 JSON 规格生成工作簿（列宽/冻结/数字格式/CSV 直转）、改既有工作簿的单元格、抽取 Word 正文与表格、生成 Word 文档（含样式/图片/分页，支持 Markdown 直转含插图）、往既有 docx 模板插入新表格（解包改 XML 回包、保模板样式）。

---

# office-docs

保留本技能的历史 Node CLI 与 DOCX 手术能力。新文档任务优先当前宿主的 office 路由及 office-docx/office-xlsx/office-render 等技能；用 load_workspace_dependencies 获取捆绑 Python/库的实际路径，不假定系统 PATH、Python 版本或缺少 openpyxl。若使用这里的 Node CLI，先核对本技能目录下的依赖是否满足；不为读取技能自动执行 npm install。

有 Python 且装了那两包时，用它们也行；这个技能的存在是为了"没有也能干"。

## 按需核对依赖

```bash
cd "<实际技能目录>"
npm ci
```

先由技能检索确认实际绝对目录，再核对 package.json、锁文件与当前可用依赖。只有当前任务授权安装时才运行 npm ci；使用目标机的现有 registry 配置，不继承作者镜像和网络测量。依赖只装入本技能目录，不自动修改全局环境。

## 六个子命令

```bash
node "<实际技能目录>/scripts/office.js" read-xlsx  <file.xlsx|file.csv> [--sheet <名>] [--json]
                                   [--range A1:C10] [--limit N] [--list-sheets] [--formulas]
node "<实际技能目录>/scripts/office.js" write-xlsx <spec.json> -o <输出.xlsx>
node "<实际技能目录>/scripts/office.js" set-xlsx   <文件.xlsx> <工作表> <单元格> <值>
node "<实际技能目录>/scripts/office.js" read-docx  <文件.docx> [--json]
node "<实际技能目录>/scripts/office.js" write-docx <spec.json> -o <输出.docx>
node "<实际技能目录>/scripts/office.js" write-docx --md <md文件|-> -o <输出.docx>
```

退出码 `0` 成功 / `1` 运行失败 / `2` 用法或前置错误（文件不存在、spec 不是合法 JSON、缺依赖、文件头不是 zip 等）。

### read-xlsx

默认输出 **markdown 表格**（第一行当表头），`--json` 输出结构化结果：

```json
[{ "name": "数据", "rowCount": 4, "colCount": 3, "rows": [["名称","数量","启用"],["甲",12,true],["丙",null,"文本"]] }]
```

**读闸门（大表防护，四个都建议先想一下用哪个）**：

| 参数 | 作用 | 典型场景 |
|---|---|---|
| `--list-sheets` | 只列 `工作表名 / 行数 / 列数`，不读数据 | 第一步摸底，"这张表里有几张表、多大" |
| `--limit N` | 每表最多读 N 行（含表头），超出会被截断并在输出里标注余量 | 看前几行样例就够时 |
| `--range A1:C10` | 只读该矩形范围（1-based 闭区间） | 已知要哪块数据，或配合 `--limit` 分页翻 |
| `--formulas` | 单元格有公式时输出公式原文（`=SUM(...)`），否则输出缓存值 | 核对算法而不是抄结果 |

`--sheet <名>` 限定单表；`.csv` 文件可以直接读（表名取文件名，首行当表头，数字自动归一）。

**读大表先只读结构**：`--list-sheets` 或 `--limit 3`，确认结构再取需要的行——整张表灌进上下文正是"回合被掐断"的常见来源。

### write-xlsx 的 spec

```json
{ "sheets": [
  { "name": "数据",
    "columns": ["名称", "数量", "启用"],
    "rows": [ ["甲", 12, true], ["乙", 3.5, false] ] }
] }
```

`columns` 作为表头并加粗；列宽按内容估算（中文字符按双宽），上限 60。数字/布尔/字符串/null 都按原类型写入。

每张表还可选：

| 字段 | 作用 |
|---|---|
| `"csv": "data.csv"` | 数据从 CSV 读（首行当表头，省掉手写 rows） |
| `"widths": [10, 20]` | 显式列宽（覆盖自适应；该列不设就仍自适应） |
| `"freeze": true \| "A2" \| {"row":1,"col":0}` | 冻结窗格（`true` = 冻结首行） |
| `"numFmt": [null, "#,##0.00"]` | 按列设数字格式（第 1 列 null 表示不设） |
| `"headerBold": false` | 表头不加粗 |

### set-xlsx（改既有工作簿的一个格）

`write-xlsx` 是整份重生成（会丢样式与其它工作表）；只想动一个格时用它。值 `=` 开头按公式、纯数字按数值、其余按文本，改完**就地保存**并打印改动前后：

```bash
node "<实际技能目录>/scripts/office.js" set-xlsx 报表.xlsx 数据 B2 99
# 已改 数据!B2: 12 → "99"（报表.xlsx 已保存）
```

### read-docx

抽 `word/document.xml` 里的**段落与表格**，默认输出纯文本（表格转 markdown），`--json` 输出块列表：

```json
[ { "type": "paragraph", "text": "季度报告" },
  { "type": "table", "rows": [["区域","金额"],["华东","1200"]] } ]
```

### write-docx 的 spec

```json
{ "blocks": [
  { "type": "heading", "level": 1, "text": "季度报告" },
  { "type": "paragraph", "text": "正文。" },
  { "type": "paragraph", "text": "红色加粗居中", "bold": true, "align": "center", "color": "FF0000", "size": 14 },
  { "type": "paragraph", "text": "斜体下划线", "italic": true, "underline": true },
  { "type": "bullet", "text": "第一条" },
  { "type": "table", "rows": [["区域","金额"],["华东","1200"]] },
  { "type": "image", "path": "图.png", "width": 480 },
  { "type": "pagebreak" }
] }
```

- `level` 支持 1–3；`align: "center"` 居中；`table` 每个单元格是字符串。
- 文字样式：`bold` / `italic` / `underline` / `size`（**单位磅**）/ `color`（十六进制，可带 `#`）。
- `image`：支持 png / jpg / gif / bmp；`width` 是**最大宽度**（像素，默认 600），小图不放大、大图等比缩到上限；按文件头自动读原始尺寸。
- `pagebreak`：分页符。

### write-docx --md（Markdown 直接转 Word）

手上是 md、要交的是 Word 时用这条，省掉手写 spec：`#`–`####` → 标题 1–4，`-`/`*` → 无序列表，`1.` → 有序列表（真编号，不是文本前缀），`| a | b |` 表格 → Word 表格（首行加粗），`![说明](图片路径 "宽度")` → 插图（宽度可省），其余按段落。`-` 表示从 stdin 读：

```bash
node "<实际技能目录>/scripts/office.js" write-docx --md 周报.md -o 周报.docx
```

只认上面这几类块——**别指望它做完整 Markdown 渲染**（粗体、链接、代码块都按普通文本原样进去）。

## 自测（改脚本后必跑）

```bash
node "<实际技能目录>/scripts/office.js" --selftest
```

48 条断言，**判据是"写出去再读回来对得上"**，不是"没报错"：xlsx 断言表头/整数/小数/空单元格不错位，docx 断言标题文本、段落文本、表格行数与单元格内容；`set-xlsx` 断言改完的值真变了；`--md` 断言四类块（标题 / 无序 / 有序 / 表格）都回读得到；读闸门断言 `--list-sheets` / `--limit` 截断提示 / `--range` 子矩阵 / `--formulas` 公式原文；CSV 读与 CSV→xlsx、列宽 / 冻结 / 数字格式回读；docx 样式（颜色 / 字号 / 斜体）、分页、内嵌图片（含 md 插图）。另含**八条负对照**——读不存在的 xlsx、无效 docx、sheet 不存在、md 源不存在、非法 `--range`、图片不存在、CSV 不存在、非 zip 文件头，都必须给出非零退出，用来证明检查真的会红。

依赖没装时自测会直接报出要装哪个包，不会静默"通过"。

## 改既有 docx（docx-surgery.js）

`office.js` 只做"读"与"新建"；**改一份已经存在的 Word**（替换文字、看修订、校验结构）用同目录的 `docx-surgery.js`：

```bash
S="<实际技能目录>/scripts/docx-surgery.js"
node "$S" replace 合同.docx 合同-v2.docx --find "三十日内" --replace "十五个工作日内"   # 跨 run 安全
node "$S" unpack  合同.docx ./unpacked && node "$S" pack ./unpacked 合同-改.docx
node "$S" validate 合同-v2.docx        # 要件齐全 + XML 全可解析
node "$S" changes  合同.docx           # 修订标记计数/作者；--accept 输出接受修订版
node "$S" --selftest                   # 11 条（含跨 run 替换正例与三条负对照）
```

**能力去向**：先读 [当前入口与缺口](references/CAPABILITIES.md)。不存在的停用目录不是可调用能力；复杂修订、批注、保真和转换必须走当前可用流程并验收，不因目录精简而静默取消需求。

## 往既有 docx 模板插入新表格（保模板样式）

要往一份**样式已定**的 Word 模板里补一张表（例：给测试方案模板续补测试用例表）。`write-docx` 是整份重生成、会丢模板样式，这条路走不通；正确链路是「解包 → 抄骨架 → 程序化生成 → 拼接 → 回包 → 回读断言」，2026-10-13 实战验证（测试用例模板 V2.0 + 24 行中间件用例表）：

1. **解包**：`node "$S" unpack 模板.docx ./tmpl_unzip`
2. **抄骨架**：在 `tmpl_unzip/word/document.xml` 里挑一张结构最接近的既有表当「样式基准」，把这些行级值抄成生成脚本的常量——`tblPr`（tblW / tblInd / 边框 / tblLayout）、`tblGrid` 列宽、`trHeight`、`tcW`、`gridSpan`、`shd fill`（表头 / 分组分隔行底色）、`vAlign`。
3. **程序化生成**：写一次性生成脚本（放 `%TEMP%/qoder-work/`）：`esc/run/para/cell/row` 小助手 + 每种「行型」一个构造函数（标题行 / 说明行 / 表头行 / 分组分隔行 / 数据行）；单元格段落可按列带格式（如长文本列用 `<w:jc w:val="left"/>` 左对齐）。
4. **拼接**：在 document.xml 里定位**最后一个 `</w:tbl>`**，其后插入「空段落 + 新表」。两个硬要求：
   - 相邻两个 `<w:tbl>` 会被 Word 并成一张表，**必须夹一个空段落**分隔；
   - 空段落写成 `<w:p><w:pPr><w:rPr><w:rFonts w:hint="eastAsia"/></w:rPr></w:pPr></w:p>`，**不要写裸 `<w:p/>`**（原因见「已知边界」）。
5. **回包 + 校验**：`node "$S" pack ./tmpl_unzip 输出.docx` → `node "$S" validate 输出.docx`
6. **回读断言（必须能失败）**：读回输出 docx 的 `word/document.xml`，断言——表总数、新表行数、逐行 `tc` 数（按行型：标题 1 / 说明 2 / 表头 6 / 分隔 1 / 数据 6）、`gridSpan` 与 `shd fill` 取值、邻表文本口令（确认没误伤其他表）、裸 `<w:p/>` 计数为 0；任一不符退出非零。**别把「能打开」当验收**。

## 已知边界（别指望它做这些）

- **`.xls` / `.doc`（旧格式）不支持**——先另存为 `.xlsx` / `.docx`。旧格式是另一套二进制格式，不是 zip。
- **文件头不是 zip 会直接拦截并给提示**：最常见的原因是**被企业安全软件透明加密**（磁盘上是密文，只有 Office 能透明解密；本机实测桌面上的 .xlsx 即是这种形态）。遇到时用 Office 打开 →「另存为」到别的目录 → 对副本调用本工具。
- **公式读到的是缓存值**：写文件时没算过结果的公式读回来是 `null`（不是 0，也不是公式文本）；要公式原文用 `--formulas`。
- **docx 只做文本、表格、样式与图片**：`office.js` 不还原页眉页脚、批注、修订痕迹、分栏、目录域；读取时同样拿不到这些。要看/改这些用 `docx-surgery.js`（修订体检与接受、解包改 XML）或 `CAPABILITIES.md` 里指的官方脚本。
- **自己拼 docx XML 时禁用裸空标签**：`<w:p/>` 这类「自闭合且无属性」的空元素会被解析成空串——曾让 `read-docx` 经 `w:hyperlink` 分支无限递归栈溢出（2026-10-13 已修复 `arr()` 并加自测；**生成侧仍一律写非自闭合形式**）。排错：`read-docx` 崩但与 PowerShell `[xml]` 严格解析结果矛盾时，先怀疑解析器对空节点的形状假设，而不是文件损坏。
- **合并单元格不特殊处理**：读到的就是左上角有值、其余为空。
- **docx 里所有内容都是字符串**：`"800"` 不是数字 `800`；要算数自己转。
- 生成的是**标准 OOXML**，Excel / Word / WPS 都能打开；但复杂版式（分栏、目录域、图表）不在能力范围内。

## 用法上的两条纪律

1. **别把整张表读进上下文**：先 `--list-sheets` / `--limit`，确认结构再取需要的行。
2. **产出物给路径不给内容**：生成的 xlsx/docx 只汇报路径与大小，别把内容贴回对话——二进制文件的真伪要靠打开看，不是靠复述。

## References（按需读）

- `references/CAPABILITIES.md`：Office 域能力去向（同域不装第二个的判据、被停技能自带脚本的位置与调用方式）。
- `references/STYLES.md`：样式层 `office-styles.js` 的主题、Markdown 结构、TOC 与验证边界。
