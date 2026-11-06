import test from 'node:test'
import assert from 'node:assert/strict'
import {runEffect} from './effect-harness.mjs'
import {apply} from '../mode-runtime.mjs'
test('effect fixture eagerly drains a legacy finally instead of suspending it',()=>{
 let removed=0
 const dispose=runEffect(function*(){try{yield}finally{removed++}})
 assert.equal(removed,1);dispose();assert.equal(removed,1)
})
test('yielded and returned disposers run exactly once in reverse order',()=>{
 const calls=[]
 const dispose=runEffect(function*(){yield()=>calls.push('first');return()=>calls.push('last')})
 assert.deepEqual(calls,[]);dispose();dispose();assert.deepEqual(calls,['last','first'])
 let direct=0;const cleanup=runEffect(()=>()=>direct++);assert.equal(direct,0);cleanup();cleanup();assert.equal(direct,1)
})
test('setup failure releases previously collected effects and still throws',()=>{
 let removed=0
 assert.throws(()=>runEffect(function*(){yield()=>removed++;throw new Error('setup-failure')}),/setup-failure/)
 assert.equal(removed,1)
})
test('production mode registration survives eager effect setup until unload',()=>{
 const tools=new Map(),removers=[];let removes=0
 const ctx={tools:{register(definition){assert.equal(tools.has(definition.name),false);tools.set(definition.name,definition);return()=>{if(tools.delete(definition.name))removes++}}},effect(factory){const dispose=runEffect(factory);removers.push(dispose);return dispose}}
 apply(ctx)
 assert.deepEqual([...tools.keys()],['jizhi_skill_search']);assert.equal(removes,0)
 for(const dispose of removers)dispose()
 assert.equal(tools.size,0);assert.equal(removes,1)
 for(const dispose of removers)dispose();assert.equal(removes,1)
})
