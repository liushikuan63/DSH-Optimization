import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {apply,catalogEntries,mergeProjectedSchemas,renderCatalogText,createCatalogMessage} from '../preset/lib/tool-catalog.mjs'
const source=fs.readFileSync(new URL('../preset/lib/tool-catalog.mjs',import.meta.url),'utf8').replace(/\r\n/g,'\n')
const start=source.indexOf('    let entries\n'),end=source.indexOf('    const inactiveSummary = catalogInactive',start)
assert.ok(start>0&&end>start,'production native/PTC selection branch must be found')
// Execute the production branch, not a reimplemented copy, with the real helpers.
const branch=Function('effectivePresentation','config','surface','descriptionMaxLength','pagedToolPatterns','resident','catalogEntries','mergeProjectedSchemas',source.slice(start,end)+'\nreturn entries')
const read={name:'read',description:'Read a file',parameters:{type:'object',properties:{file_path:{type:'string'}},required:['file_path']}}
const choose=(presentation,config)=>branch(presentation,config,[read],160,['browser_*'],[read],catalogEntries,mergeProjectedSchemas)
test('native omits resident signatures by default and when explicit',()=>{
 assert.deepEqual(choose('native',{}),[])
 assert.deepEqual(choose('native',{nativeSummaryOnly:true}),[])
})
test('native legacy opt-out actually renders its resident surface',()=>{
 const entries=choose('native',{nativeSummaryOnly:false})
 assert.equal(entries.length,1)
 assert.deepEqual(entries,catalogEntries(mergeProjectedSchemas([read],[read]),160,{patterns:['browser_*']}))
})
test('native optimization does not empty the PTC SDK catalog',()=>{
 assert.equal(choose('ptc',{}).length,1)
 assert.equal(choose('ptc',{nativeSummaryOnly:true}).length,1)
})

test('omitted native signatures are not reported as an empty or replacement tool roster',()=>{
 const inactive=[{namespace:'plugin',count:1,sample:'plugin_manager',description:'Plugin management'}]
 const options={residentSignaturesOmitted:true}
 const text=renderCatalogText([],'native',inactive,options)
 assert.match(text,/resident signatures are intentionally omitted/)
 assert.match(text,/native tool definitions/)
 assert.match(text,/namespace: "plugin"/)
 assert.doesNotMatch(text,/No tools are currently available|replaces any earlier available-tools list|complete current list/)
 assert.equal(createCatalogMessage([],'native',inactive,options).content[0].text,text)
})

test('genuinely empty native and PTC catalogs retain empty-roster semantics',()=>{
 assert.match(renderCatalogText([],'native'),/No tools are currently available/)
 const ptc=renderCatalogText([],'ptc',[],{residentSignaturesOmitted:true})
 assert.match(ptc,/No tools are currently available/)
 assert.doesNotMatch(ptc,/resident signatures are intentionally omitted/)
 assert.match(ptc,/run_code/)
})

function nativeHarness(config={}){
 const handlers=new Map(),events=[]
 const tools=[read,
  {name:'cordis_inspect_list',description:'Inspect providers',parameters:{type:'object',properties:{}}},
  {name:'cordis_inspect_query',description:'Inspect query',parameters:{type:'object',properties:{}}},
  {name:'plugin_manager',description:'Plugin management',parameters:{type:'object',properties:{action:{type:'string'}}}}]
 const registry={schemas:()=>tools}
 const ctx={effect(factory){return factory()},on(event,listener){handlers.set(event,listener)},get(key){return key==='tools'?registry:undefined},logger:{warn(){}}}
 const agent={ctx:{tools:registry},session:{events,surface:{nodes:[]}}}
 apply(ctx,{presentation:'native',pagedToolPatterns:['cordis_inspect_*','plugin_*'],maxActiveNamespaces:1,...config})
 return {tools,events,async step(){
  const input={tools}
  const assembly=await handlers.get('system-prompt/assemble')(input,{agent},async()=>input)
  const decision=await handlers.get('agent/pre-step')({agent},async()=>({kind:'enter',messages:[]}))
  return {assembly,text:decision.messages.at(-1)?.content[0].text}
 },activate(callId,namespace,error=false){events.push(
  {type:'tool/call',data:{callId,name:'tool_activate',arguments:{namespace}}},
  {type:'tool/result',data:{callId,...(error?{error:{message:'denied'}}:{})}})
 }}
}

test('native production assembly pages actual definitions and publishes truthful summaries through activation and LRU',async()=>{
 const h=nativeHarness()
 const first=await h.step()
 assert.deepEqual(first.assembly.tools.map(t=>t.name),['read'])
 assert.match(first.text,/resident signatures are intentionally omitted/)
 assert.doesNotMatch(first.text,/No tools are currently available/)
 assert.match(first.text,/namespace: "cordis_inspect"/)
 assert.match(first.text,/namespace: "plugin"/)
 h.activate('inspect-ok','cordis_inspect')
 const inspect=await h.step()
 assert.deepEqual(inspect.assembly.tools.map(t=>t.name),['read','cordis_inspect_list','cordis_inspect_query'])
 assert.equal(inspect.assembly.tools[1],h.tools[1])
 assert.doesNotMatch(inspect.text,/namespace: "cordis_inspect"/)
 assert.match(inspect.text,/namespace: "plugin"/)
 h.activate('plugin-denied','plugin',true)
 const failed=await h.step()
 assert.deepEqual(failed.assembly.tools.map(t=>t.name),['read','cordis_inspect_list','cordis_inspect_query'])
 assert.match(failed.text,/namespace: "plugin"/)
 h.activate('plugin-ok','plugin')
 const plugin=await h.step()
 assert.deepEqual(plugin.assembly.tools.map(t=>t.name),['read','plugin_manager'])
 assert.doesNotMatch(plugin.text,/namespace: "plugin"/)
 assert.match(plugin.text,/namespace: "cordis_inspect"/)
 assert.equal(h.tools.length,4,'assembly must not mutate the source registry roster')
})

test('native legacy full catalog lists exactly the assembled resident definitions',async()=>{
 const result=await nativeHarness({nativeSummaryOnly:false}).step()
 assert.deepEqual(result.assembly.tools.map(t=>t.name),['read'])
 assert.match(result.text,/<available_tools>/)
 assert.match(result.text,/- `read\(/)
 assert.doesNotMatch(result.text,/resident signatures are intentionally omitted|No tools are currently available/)
})
