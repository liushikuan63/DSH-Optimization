import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {pathToFileURL,fileURLToPath} from 'node:url'
const tmp=path.resolve(process.env.SKILL_INDEX_TEST_TMPDIR||os.tmpdir()),rel=path.relative(os.homedir(),tmp)
if(!rel||(!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel)))throw Error('Use an isolated temporary directory outside user home')
const root=fs.mkdtempSync(path.join(tmp,'foreground-contract-'));process.env.DSH_HOME=root
fs.mkdirSync(path.join(root,'hooks'))
const fallback=new URL('../plugins/hook-guards-native/index.js',import.meta.url)
const independentScope=path.join(root,'independent-scope')
if(!process.env.GUARD_SCOPE_TEST_TARGET)fs.cpSync(path.dirname(fileURLToPath(fallback)),independentScope,{recursive:true})
const globalGuard=await import(process.env.GUARD_GLOBAL_TEST_TARGET?pathToFileURL(process.env.GUARD_GLOBAL_TEST_TARGET):fallback)
const scopedGuard=await import(pathToFileURL(process.env.GUARD_SCOPE_TEST_TARGET||path.join(independentScope,'index.js')))
const authorizer=await import(process.env.GUARD_AUTHZ_MODULE?pathToFileURL(process.env.GUARD_AUTHZ_MODULE):new URL('../plugins/hook-guards-native/foreground-policy.mjs',import.meta.url))
function data(){
 const now=Date.now(),id=crypto.randomUUID(),sessionId='isolated-fixture-session'
 const grant={id,authority:'explicit-user-config',evidence:'synthetic test receipt; not a real user authorization',sessionId,cwd:root,hostPid:process.pid,pid:1234,windowId:5678,driverSession:'fixture-driver',actions:['click'],issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),maxUses:1}
 fs.writeFileSync(path.join(root,'hooks/cua-foreground-grants.json'),JSON.stringify({version:1,grants:[grant]}))
 const controller=new AbortController(),args={scope:'window',target:{kind:'window',pid:1234,window_id:5678},session:'fixture-driver',delivery_mode:'foreground'}
 const agent={id:sessionId,session:{id:sessionId,header:{id:sessionId,cwd:root}}}
 const exec={name:'cua_driver_native__click',arguments:args,agent,signal:controller.signal}
 return {grant,controller,args,exec}
}
test('the same bounded user-configured execution passes global and preset guards once without losing the user grant',()=>{
 const {exec,args}=data()
 assert.equal(globalGuard.decide(exec.name,args,exec),null)
 assert.equal(scopedGuard.decide(exec.name,args,exec),null)
 const nextArgs={...args},next={...exec,arguments:nextArgs}
 assert.equal(typeof scopedGuard.decide(exec.name,nextArgs,next),'string','a new execution cannot reuse the one-use permit')
})
test('cancelled foreground execution is refused before consuming its bounded permit',()=>{
 const {exec,args,controller}=data();controller.abort()
 assert.equal(typeof globalGuard.decide(exec.name,args,exec),'string');assert.equal(typeof scopedGuard.decide(exec.name,args,exec),'string')
 const fresh={...exec,signal:new AbortController().signal}
 assert.equal(globalGuard.decide(fresh.name,args,fresh),null)
 assert.equal(scopedGuard.decide(fresh.name,args,fresh),null)
})
test('foreground authorizer rejects quoted tool identities, expired grants and mismatched targets',()=>{
 const {exec,grant}=data()
 const check=authorizer.createForegroundAuthorizer({readPolicy:()=>({version:1,grants:[grant]}),usage:new Map()})
 assert.equal(check({...exec,name:"'cua_driver_native__click'"}),false)
 assert.equal(check({...exec,arguments:{...exec.arguments,target:{kind:'window',pid:1234,window_id:9999}}}),false)
 const expired=authorizer.createForegroundAuthorizer({readPolicy:()=>({version:1,grants:[grant]}),usage:new Map(),now:()=>Date.parse(grant.expiresAt)+1})
 assert.equal(expired(exec),false)
})
test('a valid CUA foreground permit never authorizes shell SendInput or an unbound parameter object',()=>{
 const {exec,args}=data()
 assert.equal(typeof globalGuard.decide('pwsh',{command:'SendInput(1)'},exec),'string')
 assert.equal(typeof scopedGuard.decide('pwsh',{command:'SendInput(1)'},exec),'string')
 assert.equal(typeof globalGuard.decide(exec.name,{...args},exec),'string')
 assert.equal(typeof scopedGuard.decide(exec.name,{...args},exec),'string')
})
