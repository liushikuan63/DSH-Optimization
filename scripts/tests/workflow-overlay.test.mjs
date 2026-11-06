import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const temporary=process.env.DSH_WORKFLOW_TEST_ROOT||os.tmpdir()
fs.mkdirSync(temporary,{recursive:true})
function fixture(){
 const root=fs.mkdtempSync(path.join(temporary,'workflow-owned-')),repo=path.join(root,'repo'),home=path.join(root,'home')
 fs.mkdirSync(path.join(repo,'scripts'),{recursive:true});fs.mkdirSync(path.join(repo,'overlays'));fs.mkdirSync(home)
 fs.copyFileSync(path.join(source,'scripts/install-workflow.mjs'),path.join(repo,'scripts/install-workflow.mjs'))
 fs.copyFileSync(path.join(source,'overlays/global-workflow.md'),path.join(repo,'overlays/global-workflow.md'))
 const helper=process.env.DSH_WORKFLOW_TEST_HELPER||path.join(source,'packages/ultimate-model/scripts/metadata-transaction.mjs')
 fs.mkdirSync(path.join(repo,'packages/ultimate-model/scripts'),{recursive:true});fs.copyFileSync(helper,path.join(repo,'packages/ultimate-model/scripts/metadata-transaction.mjs'))
 return{root,repo,home,entry:path.join(repo,'scripts/install-workflow.mjs'),agents:path.join(home,'AGENTS.md')}
}
function cli(f,args=[]){const r=spawnSync(process.execPath,[f.entry,'--home',f.home,...args],{cwd:f.root,encoding:'utf8',env:{...process.env,DSH_HOME:path.join(f.root,'unselected-home'),TEMP:f.root,TMP:f.root,TMPDIR:f.root}});let json;try{json=JSON.parse(r.stdout)}catch{}return{...r,json}}
test('dry-run previews APPEND without creating any file',()=>{
 const f=fixture(),original=Buffer.from('\ufeff用户现有规则\r\n保留当前默认模式\n')
 fs.writeFileSync(f.agents,original)
 const result=cli(f)
 assert.equal(result.status,0,result.stderr);assert.equal(result.json.action,'APPEND')
 assert.deepEqual(fs.readFileSync(f.agents),original);assert.deepEqual(fs.readdirSync(f.home),['AGENTS.md'])
})
const backups=f=>fs.readdirSync(f.home).filter(name=>name.startsWith('AGENTS.md.dsh-workflow-backup.'))
const state=f=>fs.readdirSync(f.home).sort().map(name=>[name,fs.statSync(path.join(f.home,name)).isFile()?fs.readFileSync(path.join(f.home,name)).toString('base64'):'dir'])
test('apply preserves BOM and mixed original newline bytes, permanent backup, then KEEP without another write',()=>{
 const f=fixture(),original=Buffer.from('\ufeff原有😀规则\r\n第二行\n无结尾换行')
 fs.writeFileSync(f.agents,original)
 const first=cli(f,['--apply']);assert.equal(first.status,0,first.stdout);assert.equal(first.json.applied,true)
 const installed=fs.readFileSync(f.agents);assert.deepEqual(installed.subarray(0,original.length),original)
 assert.equal(backups(f).length,1);assert.deepEqual(fs.readFileSync(path.join(f.home,backups(f)[0])),original)
 assert.equal(installed.subarray(original.length).toString().includes('\r\n'),true)
 fs.appendFileSync(f.agents,'\r\n用户新增的块外规则\r\n');const before=state(f),second=cli(f,['--apply'])
 assert.equal(second.status,0,second.stdout);assert.equal(second.json.action,'KEEP');assert.deepEqual(state(f),before)
})
test('create missing AGENTS only with apply and retain explicit empty preimage backup',()=>{
 const f=fixture();assert.equal(cli(f).status,0);assert.deepEqual(fs.readdirSync(f.home),[])
 const result=cli(f,['--apply']);assert.equal(result.status,0,result.stdout);assert.equal(result.json.originalExisted,false)
 assert.equal(fs.readFileSync(result.json.backup).length,0);assert.ok(fs.readFileSync(f.agents,'utf8').includes('通用任务工作流'))
})
test('locally changed managed block becomes REVIEW_UPDATE and is never overwritten',()=>{
 const f=fixture();fs.writeFileSync(f.agents,'用户规则\n');assert.equal(cli(f,['--apply']).status,0)
 fs.writeFileSync(f.agents,fs.readFileSync(f.agents,'utf8').replace('通用任务工作流','用户修改过的托管块'))
 const before=state(f),result=cli(f,['--apply']);assert.equal(result.status,3);assert.equal(result.json.action,'REVIEW_UPDATE');assert.deepEqual(state(f),before)
})
test('malformed reserved marker requires review instead of appending a second block',()=>{
 const f=fixture();fs.writeFileSync(f.agents,'<!-- DSH-OPTIMIZATION:WORKFLOW:BEGIN broken -->\n用户规则\n')
 const before=state(f),result=cli(f,['--apply']);assert.equal(result.status,3);assert.equal(result.json.action,'REVIEW_UPDATE');assert.deepEqual(state(f),before)
})
test('unknown duplicate contradictory and relative-home arguments reject without writes',()=>{
 const f=fixture();fs.writeFileSync(f.agents,'保留\n');const before=state(f)
 for(const args of [['--unknown'],['--home',f.home],['--apply','--apply'],['--apply','--dry-run']])assert.equal(cli(f,args).status,2,JSON.stringify(args))
 const result=spawnSync(process.execPath,[f.entry,'--home','relative'],{cwd:f.root,encoding:'utf8'});assert.equal(result.status,2)
 assert.deepEqual(state(f),before)
})
test('read-only AGENTS refuses before creating backup or transaction state',()=>{
 const f=fixture();fs.writeFileSync(f.agents,'保留\n');fs.chmodSync(f.agents,0o444)
 try{const result=cli(f,['--apply']);assert.equal(result.status,1,result.stdout);assert.equal(result.json.error,'WORKFLOW_AGENTS_READONLY');assert.deepEqual(fs.readdirSync(f.home),['AGENTS.md'])}finally{fs.chmodSync(f.agents,0o666)}
})
test('read-only home refuses before creating any object',()=>{
 const f=fixture();fs.chmodSync(f.home,0o444)
 try{assert.equal(fs.statSync(f.home).mode&0o222,0,'fixture must expose read-only mode');const result=cli(f,['--apply']);assert.equal(result.status,1,result.stdout);assert.equal(result.json.error,'WORKFLOW_HOME_READONLY');assert.deepEqual(fs.readdirSync(f.home),[])}finally{fs.chmodSync(f.home,0o777)}
})
test('linked home and linked ancestor refuse without changing the real target',()=>{
 const f=fixture(),link=path.join(f.root,'linked');fs.symlinkSync(f.home,link,process.platform==='win32'?'junction':'dir')
 const result=spawnSync(process.execPath,[f.entry,'--home',link,'--apply'],{cwd:f.root,encoding:'utf8'});assert.equal(result.status,1);assert.deepEqual(fs.readdirSync(f.home),[])
 const child=path.join(f.home,'child');fs.mkdirSync(child)
 const ancestor=spawnSync(process.execPath,[f.entry,'--home',path.join(link,'child'),'--apply'],{cwd:f.root,encoding:'utf8'});assert.equal(ancestor.status,1);assert.deepEqual(fs.readdirSync(child),[])
})
test('hardlinked AGENTS refuses without touching either name',()=>{
 const f=fixture(),outside=path.join(f.root,'other-owned');fs.writeFileSync(outside,'不可覆盖\n');fs.linkSync(outside,f.agents)
 const result=cli(f,['--apply']);assert.equal(result.status,1);assert.equal(result.json.error,'WORKFLOW_FILE_TYPE');assert.deepEqual(fs.readdirSync(f.home),['AGENTS.md']);assert.equal(fs.readFileSync(outside,'utf8'),'不可覆盖\n')
})
test('tampered fixed helper is rejected before any home write',()=>{
 const f=fixture();fs.appendFileSync(path.join(f.repo,'packages/ultimate-model/scripts/metadata-transaction.mjs'),'\n// own fixture byte drift\n')
 const result=cli(f,['--apply']);assert.equal(result.status,1);assert.equal(result.json.error,'WORKFLOW_HELPER_HASH');assert.deepEqual(fs.readdirSync(f.home),[])
})
test('target drift after plan is rejected before permanent backup',async()=>{
 const f=fixture();fs.writeFileSync(f.agents,'前像\n');const api=await import(pathToFileURL(f.entry)),plan=api.planWorkflow(f.home)
 fs.appendFileSync(f.agents,'并发改动\n');const changed=fs.readFileSync(f.agents)
 await assert.rejects(api.applyWorkflow(plan),/WORKFLOW_CONFLICT/);assert.deepEqual(fs.readFileSync(f.agents),changed);assert.equal(backups(f).length,0)
})
test('target drift at prepared boundary retains foreign bytes and permanent preimage',async()=>{
 const f=fixture(),original=Buffer.from('前像\n');fs.writeFileSync(f.agents,original);const api=await import(pathToFileURL(f.entry)),plan=api.planWorkflow(f.home);let changed=false
 await assert.rejects(api.applyWorkflow(plan,{onPhase:event=>{if(event.operation==='agents'&&event.phase==='prepared'&&!changed){changed=true;fs.appendFileSync(f.agents,'foreign\n')}}}),/METADATA_CONFLICT/)
 assert.equal(changed,true);assert.equal(fs.readFileSync(f.agents,'utf8'),'前像\nforeign\n');assert.equal(backups(f).length,1);assert.deepEqual(fs.readFileSync(path.join(f.home,backups(f)[0])),original)
})
test('publication failure restores full original while keeping permanent backup',async()=>{
 const f=fixture(),original=Buffer.from('\ufeff前像\r\n');fs.writeFileSync(f.agents,original);const api=await import(pathToFileURL(f.entry)),plan=api.planWorkflow(f.home)
 await assert.rejects(api.applyWorkflow(plan,{onPhase:event=>{if(event.operation==='agents'&&event.phase==='after-publish')throw Error('OWNED_PUBLISH_FAILURE')}}),/OWNED_PUBLISH_FAILURE/)
 assert.deepEqual(fs.readFileSync(f.agents),original);assert.equal(backups(f).length,1);assert.deepEqual(fs.readFileSync(path.join(f.home,backups(f)[0])),original)
})
test('overlay drift after planning rejects without creating a backup',async()=>{
 const f=fixture();const api=await import(pathToFileURL(f.entry)),plan=api.planWorkflow(f.home);fs.appendFileSync(path.join(f.repo,'overlays/global-workflow.md'),'\n新版本\n')
 await assert.rejects(api.applyWorkflow(plan),/WORKFLOW_SOURCE_CHANGED/);assert.deepEqual(fs.readdirSync(f.home),[])
})
test('mutated prepared bytes cannot replace the full AGENTS content',async()=>{
 const f=fixture();fs.writeFileSync(f.agents,'前像\n');const api=await import(pathToFileURL(f.entry)),plan=api.planWorkflow(f.home);plan.next=Buffer.from('任意替换\n')
 await assert.rejects(api.applyWorkflow(plan),/WORKFLOW_PLAN_CHANGED/);assert.equal(fs.readFileSync(f.agents,'utf8'),'前像\n');assert.equal(backups(f).length,0)
})
