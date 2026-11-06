---
name: vue
description: Vue 3 项目的开发规则——统一 Composition API 与 script setup、不解构 reactive/props 以免丢响应性、computed 只做纯计算、watch 异步要处理清理与竞态、v-if 不与 v-for 同元素、key 用稳定 id、Pinia 按领域拆分。仅在 Vue 3 项目改 .vue 文件时加载。
whenToUse: 在 Vue 3 项目里改 .vue 组件、组合式函数、Pinia store，或排查"数据改了但界面不更新"这类响应式问题时。
---

# Vue 开发规则

> **适用范围**：本技能针对 **Vue 3**；先核对目标项目的依赖与组件风格。
> React、Vue 2 或其他技术栈应使用其对应技能，不从作者历史环境推断目标机是否有 Vue 项目。

来源：Qoder 侧 `rules/vue.md`，2026-09-20 迁移为 DSH 技能。

## 一、组件写法

- 统一用 **Composition API + `<script setup>`**（Vue 3）；不与 Options API 混写。
  判据：同一 `.vue` 文件里不同时出现 `export default { data() … }` 与 `<script setup>`。
- 组件通信：props 向下 / emit 向上；跨层级用 `provide` / `inject`；全局状态用 Pinia。

## 二、响应式陷阱（最容易踩的一条）

- **不要直接解构 `reactive` 对象或 `props`**——会丢响应性。
  症状：数据确实变了，界面不更新，且没有任何报错。
  正确做法：`toRefs` / `toRef`，或直接 `props.xxx` 访问。
  判据：解构后改源对象，模板仍然更新（不更新就是踩了这个坑）。
- `ref` 与 `reactive` 选择：基本类型用 `ref`；对象集合可用 `reactive`，但**同一模块内保持统一风格**。
- `computed` **只做纯计算、不写副作用**；`watch` / `watchEffect` 里的异步要处理清理（`onCleanup`）与竞态。

## 三、模板

- **`v-if` 与 `v-for` 不要用在同一个元素上**（Vue 3 中 `v-if` 优先级更高，拿不到循环变量）。
  判据：模板里 `v-if` 用到了 `v-for` 的迭代变量时必然报错或取不到值——用 `<template v-for>` 包一层。
- 列表 `key` 用**稳定唯一 id**，不要用 index。
- 大列表考虑虚拟滚动；`v-memo` 一类优化**先测量再上**。

## 四、状态管理（Pinia）

- store **按领域拆分**；不在 store 里放纯 UI 临时状态。
- 组合式写法（setup store）与选项式**二选一**，与项目现状保持一致。

## 五、验证

- 交互改动要在**真实浏览器**验证（见 `verify-ui-in-browser`）。
  条件渲染、路由守卫、权限分支单测覆盖不到，**必须实际点击**。

## 六、反模式速查

| 反模式 | 正例 |
|---|---|
| `const { title } = props` | `const title = toRef(props, 'title')` 或 `props.title` |
| `const { list } = reactive(state)` | `const { list } = toRefs(state)` |
| 同元素上 `v-if` + `v-for` | `<template v-for>` 外层 + 内层 `v-if` |
| `computed` 里发请求/改别的状态 | `computed` 只算值，异步放 `watch` + `onCleanup` |
| `key={index}` | `key={item.id}` |

---

*迁移来源：`~/.qoder/rules/vue.md`（2026-09-20）。*
