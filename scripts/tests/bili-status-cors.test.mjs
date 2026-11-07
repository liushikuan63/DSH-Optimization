import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {transformBiliStatusCors,classifyBiliStatusCors,PINS} from '../lib/bili-status-cors.mjs'

const cli=fileURLToPath(new URL('../repair-bili-status-cors.mjs',import.meta.url))
const fixture=()=>Buffer.from('/* unrelated prefix */\r\n'+
 'async function handlePluginStatus(conversationId2,res,deps,fallbackLatest=false,trustedOrigin){const jsonHeaders=()=>{const h={"content-type":"application/json"};if(trustedOrigin!==void 0&&trustedOrigin.length>0)h["access-control-allow-origin"]=trustedOrigin;return h};let session=undefined;if(session){res.writeHead(200,jsonHeaders());res.end("{}");return}res.writeHead(404,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:fallbackLatest?"no session":"unknown plugin conversation"}));return}\r\n'+
 'async function handleAdminRoute(req,res,ctx){if(req.headers.origin!=="dsh-app://app"){res.writeHead(403,{"content-type":"application/json"});res.end(JSON.stringify({error:"denied"}));return}if(req.method!=="GET"){res.writeHead(404,{"content-type":"application/json"});res.end("{}");return}const conversationId2=new URLSearchParams(req.url.split("?")[1]).get("conversationId");if(!conversationId2){res.writeHead(400,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:"conversationId query parameter is required"}));return}return handlePluginStatus(conversationId2,res,{},false,req.headers.origin)}\r\n'+
 'function nextFunction(){return "unrelated suffix"}\r\n')
async function response(code,{origin='dsh-app://app',url='/__bili/plugin/status?conversationId=fixture',method='GET'}={}){
 const context=vm.createContext({URLSearchParams});new vm.Script(code.toString('utf8')).runInContext(context)
 const res={headers:{},writeHead(status,headers){this.status=status;this.headers=headers},end(body){this.body=body}}
 await context.handleAdminRoute({headers:{origin},url,method},res,{})
 return{status:res.status,headers:{...res.headers},body:JSON.parse(res.body)}
}
test('trusted status 400/404 remain readable while errors and foreign-origin denial stay unchanged',async()=>{
 const original=fixture(),fixed=transformBiliStatusCors(original)
 for(const url of ['/__bili/plugin/status?conversationId=fixture','/__bili/plugin/status?conversationId=']){
  const before=await response(original,{url}),after=await response(fixed,{url})
  assert.deepEqual(after.body,before.body);assert.equal(after.status,before.status)
  assert.equal(after.headers['access-control-allow-origin'],'dsh-app://app')
 }
 assert.deepEqual(await response(fixed,{origin:'https://foreign.invalid'}),await response(original,{origin:'https://foreign.invalid'}))
 assert.deepEqual(await response(fixed,{method:'OPTIONS'}),await response(original,{method:'OPTIONS'}))
 assert.ok(fixed.toString().startsWith('/* unrelated prefix */\r\n'));assert.ok(fixed.toString().endsWith('function nextFunction(){return "unrelated suffix"}\r\n'))
})
test('pure transformation rejects ambiguous targets and repeated patching',()=>{
 const original=fixture(),duplicate=Buffer.from(original.toString().replace('function nextFunction()',original.toString()+'function nextFunction()'))
 assert.throws(()=>transformBiliStatusCors(duplicate),{code:'BILI_CORS_PATCH_SHAPE'})
 assert.throws(()=>transformBiliStatusCors(transformBiliStatusCors(original)),{code:'BILI_CORS_PATCH_SHAPE'})
})
test('only the exact version and pre/post SHA classify as repair or keep',()=>{
 assert.equal(classifyBiliStatusCors({name:'billion-context',version:'0.1.212',sha256:PINS.before}).action,'REPAIR')
 assert.equal(classifyBiliStatusCors({name:'billion-context',version:'0.1.212',sha256:PINS.after}).action,'KEEP')
 for(const metadata of [{name:'other',version:'0.1.212',sha256:PINS.before},{name:'billion-context',version:'0.1.213',sha256:PINS.before},{name:'billion-context',version:'0.1.212',sha256:'0'.repeat(64)}])assert.equal(classifyBiliStatusCors(metadata).action,'REVIEW_UPDATE')
})
const own=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'bili-cors-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root}
const tree=root=>{const bundle=path.join(root,'bundle');fs.mkdirSync(path.join(bundle,'dist'),{recursive:true});fs.writeFileSync(path.join(bundle,'package.json'),JSON.stringify({name:'billion-context',version:'0.1.212'}));fs.writeFileSync(path.join(bundle,'dist','index.js'),'throw Error("TARGET_CODE_MUST_NOT_EXECUTE");\n');return bundle}
const run=args=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:15000})
test('CLI unknown bytes are preserved in dry-run and apply, without loading a transaction helper',t=>{
 const root=own(t),bundle=tree(root),code=path.join(bundle,'dist','index.js'),before=fs.readFileSync(code),mtime=fs.statSync(code).mtimeMs,backup=path.join(root,'backup');fs.mkdirSync(backup)
 for(const args of [['--bundle-root',bundle],['--bundle-root',bundle,'--apply','--backup-dir',backup]]){
  const child=run(args);assert.equal(child.status,3,child.stderr);assert.equal(JSON.parse(child.stdout).action,'REVIEW_UPDATE')
  assert.deepEqual(fs.readFileSync(code),before);assert.equal(fs.statSync(code).mtimeMs,mtime);assert.deepEqual(fs.readdirSync(backup),[]);assert.deepEqual(fs.readdirSync(path.join(bundle,'dist')),['index.js'])
 }
})
test('CLI requires explicit absolute paths and backup for apply',t=>{
 const root=own(t),bundle=tree(root)
 for(const args of [[],['--bundle-root','relative'],['--bundle-root',bundle,'--apply'],['--bundle-root',bundle,'--apply','--dry-run'],['--bundle-root',bundle,'--unknown']])assert.equal(run(args).status,2)
})
test('dist links cannot escape the explicitly resolved bundle root',t=>{
 const root=own(t),bundle=tree(root),outside=path.join(root,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'index.js'),'preserve')
 fs.rmSync(path.join(bundle,'dist'),{recursive:true});fs.symlinkSync(outside,path.join(bundle,'dist'),process.platform==='win32'?'junction':'dir')
 const child=run(['--bundle-root',bundle]);assert.equal(child.status,1);assert.equal(JSON.parse(child.stdout).error,'BILI_CORS_PATH_BOUNDARY');assert.equal(fs.readFileSync(path.join(outside,'index.js'),'utf8'),'preserve')
})
test('restore accepts explicit dry-run syntax but rejects an untrusted receipt without touching code',t=>{
 const root=own(t),bundle=tree(root),backup=path.join(root,'backup');fs.mkdirSync(backup)
 const receipt=path.join(backup,'untrusted.json');fs.writeFileSync(receipt,'{"schemaVersion":1,"kind":"unknown"}')
 const before=fs.readFileSync(path.join(bundle,'dist','index.js')),args=['--bundle-root',bundle,'--backup-dir',backup,'--restore-receipt',receipt]
 const child=run(args);assert.equal(child.status,1);assert.equal(JSON.parse(child.stdout).error,'BILI_CORS_RESTORE_RECEIPT')
 assert.deepEqual(fs.readFileSync(path.join(bundle,'dist','index.js')),before);assert.deepEqual(fs.readdirSync(backup),['untrusted.json'])
 assert.equal(run(['--bundle-root',bundle,'--restore-receipt',receipt]).status,2)
})
