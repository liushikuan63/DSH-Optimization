# Office 能力去向与当前边界

历史“停用脚本原样保留且已实测”的说法不再适用：本机相应停用目录没有这些脚本。不得照抄旧路径或自行宣称已恢复。

| 需求 | 当前入口 | 验收与边界 |
| --- | --- | --- |
| 常规 Word/Excel/PPT | 当前宿主 office → office-docx / office-xlsx / office-pptx | 先加载对应技能，用 load_workspace_dependencies 取捆绑环境；目标机器不可得时明确缺口 |
| 既有DOCX解包/回包/跨run替换 | 本技能 scripts/docx-surgery.js，或当前 office-docx 流程 | Node替换可能牺牲被替换段的局部格式；不能宣称任意保真 |
| 批注/复杂或嵌套修订 | 当前 office-docx 支持的具体流程 | 先核对实际能力；没有现成入口则保留需求并报告未实现，不引用不存在的comment.py |
| Excel公式、样式、批注与合并 | 当前 office-xlsx、捆绑openpyxl/XlsxWriter | 公式缓存刷新另走 office-recalculate；写公式不等于已计算 |
| PDF转换/布局图 | 当前 office-export-pdf / office-render | 按目标机LOKit技能契约操作，不因旧“未安装LibreOffice”记录推断当前不可用 |
| JSON/CSV→XLSX、Markdown→DOCX | 本技能 scripts/office.js | 保留历史Node CLI；先确认本技能本地依赖，不把命令存在当本轮验收 |
| 三套主题、目录域、页码、取色 | 本技能 scripts/office-styles.js；详见 STYLES.md | 历史测试数量不是本轮证据，实际文档要渲染检查 |
| SQL→Excel管线 | 先按database-discipline只读取数，再用当前xlsx流程 | 不存在历史SQL_TO_EXCEL_RECIPE；查询授权、参数绑定、敏感脱敏、数据量/类型需另验 |

示例命令都相对本技能加载后报告的base directory；若位于分享包，目录是skills/library/office-docs，而不是目标机home。禁止为恢复能力递归移动/删除用户技能。

原则：收敛入口，不把能力缺口藏在“已保留”的口号里。脚本测试、库可导入、文档内容与实际渲染分别验；本页不是所有高级Office能力已实测的声明。
