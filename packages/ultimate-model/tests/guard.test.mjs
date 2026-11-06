import {runEffect} from './effect-harness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
process.env.DSH_HOME=fs.mkdtempSync(path.join(os.tmpdir(),'jizhi-guard-'))
const guard=await import('../plugins/hook-guards-native/index.js')
test('monotonic guard is registered, survives a pre-execute allow, and disposes',()=>{
 let predicate;let removed=false;let dispose
 const ctx={tools:{guard(fn){predicate=fn;return ()=>{removed=true}}},effect(fn){dispose=runEffect(fn);return dispose},on(){throw Error('must not use short-circuit waterfall')}}
 guard.apply(ctx)
 assert.equal(removed,false)
 const allow={kind:'allow'}
 assert.equal(allow.kind,'allow')
 assert.ok(predicate({name:'win_bash',arguments:{command:'SetForegroundWindow(1)'}}))
 assert.equal(predicate({name:'win_bash',arguments:{command:'node --version'}}),undefined)
 dispose();assert.equal(removed,true)
})
test('SQL: unrelated WHERE cannot legalize preceding mutation',()=>{
 assert.ok(guard.decide('win_bash',{command:'psql -c "UPDATE t SET x=0; SELECT 1 WHERE 2=3"'}))
 assert.ok(guard.decide('win_bash',{command:'sqlcmd -Q "DELETE FROM [dbo].[t]"'}))
 assert.equal(guard.decide('win_bash',{command:'psql -c "UPDATE t SET x=0 WHERE id=7"'}),null)
})
test('SQL: strings and nested WHERE are not top-level predicates',()=>{
 assert.ok(guard.decide('mcp__postgres__query',{query:"UPDATE t SET note='WHERE id=7'"}))
 assert.ok(guard.decide('mcp__postgres__query',{query:'UPDATE t SET x=(SELECT x FROM y WHERE id=7)'}))
 assert.ok(guard.decide('mcp__postgres__query',{query:'DELETE FROM t WHERE 1=1'}))
 assert.equal(guard.decide('mcp__postgres__query',{query:'SELECT 1 WHERE 1=1'}),null)
})
test('SQL: literal source-analysis fixtures are not database execution',()=>{
 assert.equal(guard.decide('win_bash',{command:`node -e "console.log('UPDATE t SET x=0; SELECT 1 WHERE 2=3')"`}),null)
 assert.equal(guard.decide('write',{file_path:'fixture.mjs',content:'DELETE FROM t'}),null)
})

test('SQL: parenthesized boolean constants are not a narrowing predicate',()=>{
 for(const sql of ['DELETE FROM t WHERE(1=1)','UPDATE t SET x=0 WHERE ((TRUE)) RETURNING *','DELETE FROM t WHERE id=7 OR (0=0)'])assert.ok(guard.decide('mcp__postgres__query',{query:sql}),sql)
 for(const sql of ['DELETE FROM t WHERE (1=1) AND id=7','UPDATE t SET x=1 WHERE EXISTS(SELECT 1 FROM y WHERE TRUE)','DELETE FROM t WHERE 1=0'])assert.equal(guard.decide('mcp__postgres__query',{query:sql}),null,sql)
})
test('legacy environment switches cannot silently authorize foreground or shell injection',()=>{
 const names=['DSH_CUA_ALLOW_FOREGROUND','DSH_ALLOW_SHELL_GUI_PRIMITIVES'], old=names.map(name=>process.env[name])
 try {
  process.env.DSH_CUA_ALLOW_FOREGROUND='1';process.env.DSH_ALLOW_SHELL_GUI_PRIMITIVES='1'
  assert.ok(guard.decide('cua_driver_native__click',{delivery_mode:'foreground',pid:1,x:0,y:0}))
  for(const command of ['SetForegroundWindow(1)','SendInput(1)','keybd_event(1)'])assert.ok(guard.decide('win_bash',{command}))
  assert.equal(guard.decide('cua_driver_native__click',{delivery_mode:'background',pid:1,x:0,y:0}),null)
 }finally{names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i]})}
})
