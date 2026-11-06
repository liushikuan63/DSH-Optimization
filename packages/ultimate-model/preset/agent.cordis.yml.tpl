[
  {
    "id": "persona",
    "name": "@deepseek-ai/dsh-persona",
    "config": {
      "prefix": "You are a coding agent powered by the {{model}} model.\n你在显式选择的Ultimate Model工作：压缩无用形式，不压缩必要证据。先遵守系统/开发者与用户具体授权；相关任务按需读取 jizhi-mode。低频技能用 jizhi_skill_search 后读取真实文件。工具族只按当前摘要激活，成功结果才算激活；未执行不声称生效。\n任务开始明确目标与可失败完成判据；长/复杂任务维护现有 VibeCoding 文档，沿宿主 Goal/Plan 契约分段推进。每段实施后验证并更新状态；还有已授权可行下一步就继续，阶段汇报不算收工。完成前核对全部目标与本轮证据；受阻说明具体原因和剩余项，用户取消立即停止。写改前读当前内容并核对写域/归属，保护已有修改；破坏性动作按当前授权先预演、备份和恢复验证，不猜目录、不批量覆盖或删除。"
    }
  },
  {
    "id": "agent-instructions",
    "name": "@deepseek-ai/dsh-agent-instructions",
    "config": {
      "maxBytes": 65536
    }
  },
  {
    "id": "tool-bash",
    "name": "@deepseek-ai/dsh-tool-bash",
    "disabled": {
      "__jsExpr": "process.platform === 'win32'"
    }
  },
  {
    "id": "tool-pwsh",
    "name": "@deepseek-ai/dsh-tool-pwsh",
    "disabled": {
      "__jsExpr": "process.platform !== 'win32'"
    }
  },
  {
    "id": "tool-fs",
    "name": "@deepseek-ai/dsh-tool-fs"
  },
  {
    "id": "tool-fs-search",
    "name": "@deepseek-ai/dsh-tool-fs-search",
    "config": {
      "sampleOverCapGlobResults": false
    }
  },
  {
    "id": "tool-str-replace-editor",
    "name": "@deepseek-ai/dsh-tool-str-replace-editor"
  },
  {
    "id": "tool-jobs",
    "name": "@deepseek-ai/dsh-tool-jobs"
  },
  {
    "id": "skill-filesystem",
    "name": "@deepseek-ai/dsh-skill-filesystem",
    "config": {
      "customSkillDirs": [
        {
          "__jsExpr": "(() => {\n  const path = process.getBuiltinModule(\"node:path\");\n  const { createRequire } = process.getBuiltinModule(\"node:module\");\n  const root = path.dirname(createRequire(baseUrl).resolve(\"@local/ultimate-model/package.json\"));\n  return path.join(root, \"./skills/core\");\n})()"
        },
        {
          "__jsExpr": "(() => {\n  const path = process.getBuiltinModule(\"node:path\");\n  const { createRequire } = process.getBuiltinModule(\"node:module\");\n  const root = path.dirname(createRequire(baseUrl).resolve(\"@local/ultimate-model/package.json\"));\n  return path.join(root, \"./preset/skills\");\n})()"
        },
        {
          "__jsExpr": "(() => {\n  const path = process.getBuiltinModule(\"node:path\");\n  const { createRequire } = process.getBuiltinModule(\"node:module\");\n  const root = path.dirname(createRequire(baseUrl).resolve(\"@local/ultimate-model/package.json\"));\n  return path.join(root, \"./skills/local\");\n})()"
        }
      ]
    }
  },
  {
    "id": "tool-skill",
    "name": "@deepseek-ai/dsh-tool-skill"
  },
  {
    "id": "command-goal",
    "name": "@deepseek-ai/dsh-command-goal"
  },
  {
    "id": "tool-goal",
    "name": "@deepseek-ai/dsh-tool-goal"
  },
  {
    "id": "planning",
    "name": "cordis:group",
    "group": true,
    "isolate": {
      "planMode": true
    },
    "config": [
      {
        "id": "plan-mode",
        "name": "@deepseek-ai/dsh-plan-mode",
        "config": {
          "section": "You are in plan mode. Stay in plan mode until exit_plan_mode succeeds or the user switches the session mode. Imperative language to implement changes means plan the implementation, not execute it. A user's conversational agreement — including an answer confirming something you asked — approves nothing and does not end plan mode; fold the confirmed decision into the plan and submit it through exit_plan_mode.\n\nExplore first. Use non-mutating reads, searches, static analysis, and checks to ground the plan in the actual repository. Do not edit or write files, change configuration, run formatters or code generation that rewrites tracked files, commit, or otherwise carry out the plan. Prefer existing functions and patterns over new machinery.\n\nThe tool catalog stays the same across modes for request-cache stability. These plan-mode rules override any later tool description or guidance that suggests using mutation tools; those tools remain listed to keep the tool catalog unchanged. Do not use todo_write to track this planning phase: it tracks implementation after an approved plan, while the plan itself belongs in exit_plan_mode.\n\nResolve discoverable facts by inspection. Use ask_user_question only for user-owned choices or material ambiguity that inspection cannot answer. Do not ask the user where code lives or how current behavior works when you can find out.\n\nMake the plan decision-complete: state the goal and success criteria; group implementation changes by subsystem; identify public API, schema, and data-flow changes; cover edge cases, failure modes, tests, acceptance criteria, and explicit assumptions. Keep it concise enough to review but detailed enough that another engineer can implement it without making design decisions.\n\nWhen ready, call exit_plan_mode with the complete plan markdown, starting with a # title. Make exit_plan_mode the only and final tool call in that assistant response: it presents the plan for approval, and implementation begins only in a later step after approval. Do not paste the final plan as a plain reply or ask \"should I proceed?\" through prose or ask_user_question. If review rejects it, incorporate the feedback and present again. If the review channel is unavailable or aborted, stay in plan mode and ask the user to switch modes manually; do not proceed with implementation.\n\n本机附加约定（验收判据必须写进计划本身，而不是留到实施时再说）：\n- 每条完成判据都要能失败：写明本轮实际会执行的命令、期望的退出码，以及负向对照（如\"不存在的路径 / 不存在的接口\"必须走到失败分支并给出预期响应）。\n- 判据来源是**本项目 AGENTS.md 声明的验证入口**，不是通用模板：项目若已有静态门 / 单测 / 运行时探针，就用它们，\n  不要因为\"通用经验说这类项目没有测试\"而跳过现成门禁；项目若确实没有自动化测试，功能可用才只能由\n  「真实启动 + 真实请求 + 真页面实跑截图」证明，构建通过或 lint 通过都不算。\n- 涉及数据：先给 SELECT 查证影响面；涉及结构或数据变更：写明备份与回滚步骤。\n- 涉及配置或服务变更：写明回滚步骤，并说明为什么它不破坏正在使用的软件。\n- 涉及提交：按项目 AGENTS.md 声明的版本控制（git 或 svn）写明提交范围（逐个明确路径）\n  与明确不提交项（构建产物目录、未纳管目录、任何凭据）。\n- 写明本轮**不做什么**（范围边界），避免实施时扩大到无关模块。\n- 涉及安装包 / 发布产物时，写明独立验收方式：由谁、在哪台真实环境、用什么命令与证据验收；\n  构建、单测或实现者自述不能代替实装验收。\n- 列出显式假设、被排除的方案及排除理由，以及可回退点。\n"
        }
      }
    ]
  },
  {
    "id": "compaction",
    "name": "cordis:group",
    "group": true,
    "isolate": {
      "compaction": true,
      "toolResultPruner": true
    },
    "config": [
      {
        "id": "compaction-basic",
        "name": "@deepseek-ai/dsh-compaction-basic"
      },
      {
        "id": "command-compact",
        "name": "@deepseek-ai/dsh-command-compact"
      },
      {
        "id": "tool-result-pruner",
        "name": "@deepseek-ai/dsh-compaction-tool-result-pruner",
        "config": {
          "thresholdChars": 8192,
          "headChars": 4096,
          "tailChars": 1024
        }
      }
    ]
  },
  {
    "id": "delegation",
    "name": "cordis:group",
    "group": true,
    "isolate": {
      "workflowEngine": true
    },
    "config": [
      {
        "id": "tool-subagent-control",
        "name": "@deepseek-ai/dsh-tool-subagent-control"
      },
      {
        "id": "tool-subagent-list-agents",
        "name": "@deepseek-ai/dsh-tool-subagent-control/list-agents"
      },
      {
        "id": "tool-subagent",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "spawn",
          "toolName": "subagent",
          "modelSelectionSettings": true,
          "backgroundMode": "continuable"
        }
      },
      {
        "id": "tool-subagent-fork",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "config": {
          "provider": "fork",
          "toolName": "subagent_fork",
          "backgroundMode": "continuable"
        }
      },
      {
        "id": "tool-subagent-codex",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "disabled": true,
        "config": {
          "provider": "codex",
          "toolName": "subagent_codex",
          "backgroundMode": "one-shot",
          "maxDepth": "provider-managed"
        }
      },
      {
        "id": "tool-subagent-claude-code",
        "name": "@deepseek-ai/dsh-tool-subagent",
        "disabled": true,
        "config": {
          "provider": "claude-code",
          "toolName": "subagent_claude_code",
          "backgroundMode": "one-shot",
          "maxDepth": "provider-managed"
        }
      },
      {
        "id": "workflow-ptc",
        "name": "@deepseek-ai/dsh-workflow-ptc",
        "config": {
          "provider": "spawn"
        }
      },
      {
        "id": "tool-workflow",
        "name": "@deepseek-ai/dsh-tool-workflow"
      },
      {
        "id": "tool-ralph",
        "name": "@deepseek-ai/dsh-tool-ralph",
        "config": {
          "subagentProvider": "spawn",
          "maxRounds": 64
        }
      }
    ]
  },
  {
    "id": "tool-ask-user",
    "name": "@deepseek-ai/dsh-tool-ask-user",
    "config": {
      "mode": "legacy"
    }
  },
  {
    "id": "tool-todo",
    "name": "@deepseek-ai/dsh-tool-todo",
    "config": {
      "allowParallelInProgress": true
    }
  },
  {
    "id": "tool-web",
    "name": "@deepseek-ai/dsh-tool-web",
    "config": {
      "fetch": true,
      "searchTimeoutMs": 60000
    }
  },
  {
    "id": "present",
    "name": "@deepseek-ai/dsh-tool-present"
  },
  {
    "id": "tool-cordis",
    "name": "@deepseek-ai/dsh-tool-cordis"
  },
  {
    "id": "tool-plugin-manager",
    "name": "@deepseek-ai/dsh-plugin-manager/tools",
    "disabled": {
      "__jsExpr": "!ctx.get('profileContext')"
    }
  },
  {
    "id": "tool-catalog",
    "name": {
      "__jsExpr": "(() => {\nconst path = process.getBuiltinModule(\"node:path\");\nconst { createRequire } = process.getBuiltinModule(\"node:module\");\nconst root = path.dirname(createRequire(baseUrl).resolve(\"@local/ultimate-model/package.json\"));\nreturn path.join(root, \"./preset/lib/tool-catalog.mjs\");\n})()"
    },
    "config": {
      "descriptionMaxLength": 160,
      "presentation": "native",
      "pagedToolPatterns": [
        "cua_driver_*",
        "mcp__playwright__*",
        "task_board_*",
        "agent_teams_*",
        "team_task_*",
        "browser_*",
        "cordis_inspect_*",
        "plugin_*"
      ],
      "maxActiveNamespaces": 3,
      "maxResidentTokens": 16000,
      "nativeSummaryOnly": true
    }
  },
  {
    "id": "tool-activate",
    "name": {
      "__jsExpr": "(() => {\nconst path = process.getBuiltinModule(\"node:path\");\nconst { createRequire } = process.getBuiltinModule(\"node:module\");\nconst root = path.dirname(createRequire(baseUrl).resolve(\"@local/ultimate-model/package.json\"));\nreturn path.join(root, \"./preset/lib/tool-activate.mjs\");\n})()"
    },
    "config": {
      "pagedToolPatterns": [
        "cua_driver_*",
        "mcp__playwright__*",
        "task_board_*",
        "agent_teams_*",
        "team_task_*",
        "browser_*",
        "cordis_inspect_*",
        "plugin_*"
      ],
      "maxActiveNamespaces": 3
    }
  },
  {
    "id": "ultimate-model-runtime",
    "name": "@local/ultimate-model"
  },
  {
    "id": "ultimate-model-scoped-guards",
    "name": {
      "__jsExpr": "(() => {\nconst path = process.getBuiltinModule(\"node:path\");\nconst { createRequire } = process.getBuiltinModule(\"node:module\");\nconst root = path.dirname(createRequire(baseUrl).resolve(\"@local/ultimate-model/package.json\"));\nreturn path.join(root, \"./plugins/hook-guards-native/index.js\");\n})()"
    }
  }
]
