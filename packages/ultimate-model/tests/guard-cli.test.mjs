import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const cli=fileURLToPath(new URL('../plugins/hook-guards-native/check.mjs',import.meta.url))
const run=input=>spawnSync(process.execPath,[cli],{input,encoding:'utf8'})
test('legacy CLI preflight accepts harmless input but does not execute commands',()=>{
 const result=run(JSON.stringify({tool_name:'win_bash',tool_input:{command:'node --version'}}))
 assert.equal(result.status,0);assert.deepEqual(JSON.parse(result.stdout),{reason:null});assert.equal(result.stderr,'')
})
test('legacy CLI shares SQL parentheses protection',()=>{
 const result=run(JSON.stringify({tool_name:'mcp__postgres__query',tool_input:{query:'DELETE FROM t WHERE(1=1)'}}))
 assert.equal(result.status,0);assert.ok(JSON.parse(result.stdout).reason)
})
test('legacy CLI malformed, missing or oversized input fails closed without raw payload',()=>{
 for(const input of ['not-json','{}','null',JSON.stringify({tool_name:'read',tool_input:[]}), ' '.repeat(65537)]){
  const result=run(input);assert.equal(result.status,1);assert.match(JSON.parse(result.stdout).reason,/未执行/);assert.equal(result.stderr,'')
 }
})
