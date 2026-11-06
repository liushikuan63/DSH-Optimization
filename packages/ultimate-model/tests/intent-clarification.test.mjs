import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {collect} from '../scripts/build-skills-index.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8')
const skill=()=>read('skills/core/intent-clarification/SKILL.md')
function contract(text){
 for(const phrase of ['保留原意','待确认','2–4 个合理选项','建议理由','确认前不执行依赖歧义的动作','推荐、超时、自动答复不等于用户确认','澄清不是执行授权','明确请求直接推进','可查事实先查'])assert.ok(text.includes(phrase),'Missing intent contract: '+phrase)
}
test('intent skill is discoverable once with focused triggers',()=>{
 const entries=collect({bundleRoot:root}).filter(entry=>entry.name==='intent-clarification')
 assert.equal(entries.length,1);assert.equal(entries[0].tier,'core')
 assert.match(entries[0].description,/提示词优化/);assert.match(entries[0].description,/歧义/)
})
test('intent guidance and mode/rules routes retain the clarification boundaries',()=>{
 contract(skill())
 const rules=read('rules/AGENTS.md'),mode=read('preset/skills/jizhi-mode/SKILL.md')
 assert.match(rules,/intent-clarification/);assert.match(rules,/未获真人确认不执行依赖歧义的动作/)
 assert.match(mode,/intent-clarification/)
})
test('text contract checker fails when confirmation-before-action is removed',()=>{
 const original=skill();contract(original)
 const altered=original.replace('确认前不执行依赖歧义的动作','确认前先执行依赖歧义的动作')
 assert.notEqual(altered,original);assert.throws(()=>contract(altered),assert.AssertionError)
})
test('text contract checker fails when automatic answers are accepted as confirmation',()=>{
 const original=skill();contract(original)
 const altered=original.replace('推荐、超时、自动答复不等于用户确认','推荐、超时、自动答复等于用户确认')
 assert.notEqual(altered,original);assert.throws(()=>contract(altered),assert.AssertionError)
})
