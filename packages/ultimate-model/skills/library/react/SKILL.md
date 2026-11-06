---
name: react
description: 现代 React（函数组件 + Hooks）的开发规则——Hooks 只能在顶层调用、依赖数组必须完整且不许 disable exhaustive-deps、派生数据不在 effect 里同步、Effect 必须清理与防竞态、key 用稳定 id、服务端状态与客户端状态分开管。仅在 hooks 式 React 项目改 tsx/jsx 时加载。
whenToUse: 在函数组件 + Hooks 的 React 项目里改组件、自定义 Hook、状态管理或排查渲染与竞态问题时。
---

# React 开发规则

> **适用范围（先看这条）**：本技能针对**函数组件 + Hooks** 的 React 项目。
> 若目标项目前端是**旧版 React（class 组件、无 hooks）**，
> 先按目标项目的组件风格和 `AGENTS.md` 选择技能，不把 Hooks 写法直接套入旧组件。
> `useEffect` 适用于 Hooks 组件；class 项目的生命周期、状态管理和副作用机制须按其实际实现核验，不能推定为 DVA。

来源：Qoder 侧 `rules/react.md`，2026-09-20 迁移为 DSH 技能。

## 一、Hooks（每条都能失败）

| 规则 | 判据 |
|---|---|
| 只在组件或自定义 Hook 的**顶层**调用 Hooks | ESLint `react-hooks/rules-of-hooks` 零报错（放条件/循环里必报） |
| 依赖数组必须完整 | `react-hooks/exhaustive-deps` 零报错；**不许用 `// eslint-disable-next-line` 绕过**——那通常意味着逻辑有问题 |
| 状态更新用函数式写法 `setX(prev => …)` | 连续两次 `setCount(c => c + 1)` 后计数 +2（写成 `setCount(count + 1)` 只会 +1） |
| **派生数据在渲染中直接算**，不要 `useEffect` + `setState` 同步 | 组件里搜不到"为同步派生值而写的 effect"；渲染次数比同步写法少一次 |
| Effect 必须清理 | 订阅/定时器/监听器都有 `return` 清理函数；卸载后不再触发回调 |
| 请求用 `AbortController` 防竞态 | 快速切换参数时，慢响应的旧请求不会覆盖新结果（组件卸载后不 setState） |

## 二、渲染

- 列表 `key` 用**稳定唯一 id**，不要用数组索引——增删/排序会错位并丢组件状态。
  判据：在列表头部插入一项，已有项的输入框内容不串位。
- 受控与非受控**二选一**：表单组件统一一种模式，不要中途切换（React 会报受控/非受控切换警告）。
- **不要过早 `memo` / `useMemo` / `useCallback`**：先测量再优化；滥用反而增加复杂度。

## 三、状态管理

- **服务端状态**（缓存、重试、失效）用 TanStack Query 一类库；**客户端状态**（UI、表单）用本地 state 或轻量 store——
  **不要把所有东西塞进全局 store**。
- 跨组件共享的状态提升到**最近的公共祖先**，不要为省事直接全局化。

## 四、验证

- 交互改动要在**真实浏览器**验证（见 `verify-ui-in-browser`）。
  React 的 Suspense / 条件渲染 / 路由守卫分支单测覆盖不到，**必须实际点击**。

## 五、反模式速查

| 反模式 | 正例 |
|---|---|
| `// eslint-disable-next-line react-hooks/exhaustive-deps` | 补全依赖，或用 `useCallback`/`useRef` 稳定引用 |
| `useEffect(() => setFull(a + b), [a, b])` | 渲染中直接 `const full = a + b` |
| `key={index}` | `key={item.id}` |
| 所有状态进 Redux/Zustand | 服务端状态进 TanStack Query，UI 状态留本地 |

---

*迁移来源：`~/.qoder/rules/react.md`（2026-09-20）。*
