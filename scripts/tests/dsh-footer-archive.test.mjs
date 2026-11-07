import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {encodeAsarHeader,inspectAsarLayout,appendPackedFooter,embeddedIntegrityFuseState,classifyDshFooterArchive,ARCHIVE_PINS} from '../lib/dsh-footer-archive.mjs'
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),cli=fileURLToPath(new URL('../repair-dsh-footer-layout.mjs',import.meta.url))
function fixture(){const payload=Buffer.from('{}oldKEEP'),header={files:{'package.json':{size:2,offset:'0'},lib:{files:{'client.js':{size:3,offset:'2',integrity:{algorithm:'SHA256',hash:hash(Buffer.from('old')),blockSize:4194304,blocks:[hash(Buffer.from('old'))]}}}},keep:{size:4,offset:'5'},'native.node':{size:7,unpacked:true,integrity:{algorithm:'SHA256',hash:'f'.repeat(64)}}}};return{bytes:Buffer.concat([encodeAsarHeader(header),payload]),header,payload}}
test('append updates one packed entry and preserves every old payload byte and unrelated entry',()=>{
 const before=fixture(),client=Buffer.from('new owned client'),after=appendPackedFooter(before.bytes,client),decoded=inspectAsarLayout(after)
 assert.equal(decoded.header.files.lib.files['client.js'].offset,String(before.payload.length));assert.equal(decoded.header.files.lib.files['client.js'].size,client.length)
 assert.equal(decoded.header.files.lib.files['client.js'].integrity.hash,hash(client));assert.deepEqual(decoded.payload.subarray(0,before.payload.length),before.payload);assert.deepEqual(decoded.payload.subarray(before.payload.length),client)
 assert.deepEqual(decoded.header.files.keep,before.header.files.keep);assert.deepEqual(decoded.header.files['native.node'],before.header.files['native.node']);assert.deepEqual(decoded.header.files['package.json'],before.header.files['package.json'])
})
test('invalid pickle/header ranges, non-packed target and out-of-range entries are refused',()=>{
 assert.throws(()=>inspectAsarLayout(Buffer.alloc(16)))
 for(const mutate of [h=>h.files.lib.files['client.js'].unpacked=true,h=>h.files.keep.offset='99999']){
  const f=fixture();mutate(f.header);assert.throws(()=>appendPackedFooter(Buffer.concat([encodeAsarHeader(f.header),f.payload]),Buffer.from('new')))
 }
})
test('fuse read is data-only and unknown or enabled executables never qualify',()=>{
 const sentinel=Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'),data=Buffer.concat([sentinel,Buffer.from([1,8,49,48,49,49,48,48,48,49])])
 assert.equal(embeddedIntegrityFuseState(data),'DISABLED');data[sentinel.length+2+4]=49;assert.equal(embeddedIntegrityFuseState(data),'ENABLED');assert.equal(embeddedIntegrityFuseState(Buffer.from('unknown')),'UNKNOWN')
 assert.equal(classifyDshFooterArchive({archiveHash:ARCHIVE_PINS.before,exeHash:ARCHIVE_PINS.exe,fuse:'DISABLED',nlink:1}).action,'REPAIR')
 assert.equal(classifyDshFooterArchive({archiveHash:ARCHIVE_PINS.after,exeHash:ARCHIVE_PINS.exe,fuse:'DISABLED',nlink:1}).action,'KEEP')
 for(const metadata of [{archiveHash:'0'.repeat(64),exeHash:ARCHIVE_PINS.exe,fuse:'DISABLED',nlink:1},{archiveHash:ARCHIVE_PINS.before,exeHash:'0'.repeat(64),fuse:'ENABLED',nlink:1},{archiveHash:ARCHIVE_PINS.before,exeHash:ARCHIVE_PINS.exe,fuse:'ENABLED',nlink:1},{archiveHash:ARCHIVE_PINS.before,exeHash:ARCHIVE_PINS.exe,fuse:'DISABLED',nlink:2}])assert.equal(classifyDshFooterArchive(metadata).action,'REVIEW_UPDATE')
})
test('CLI defaults to read-only review for unknown files and never loads a missing helper',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-footer-unit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const archive=path.join(root,'app.asar'),exe=path.join(root,'host.exe'),backup=path.join(root,'backup');fs.mkdirSync(backup);fs.writeFileSync(archive,'unknown archive');fs.writeFileSync(exe,'unknown exe');const before=fs.readFileSync(archive)
 for(const extra of [[],['--apply','--backup-dir',backup]]){const result=spawnSync(process.execPath,[cli,'--asar',archive,'--electron-exe',exe,...extra],{encoding:'utf8'});assert.equal(result.status,3,result.stderr);assert.equal(JSON.parse(result.stdout).action,'REVIEW_UPDATE');assert.deepEqual(fs.readFileSync(archive),before);assert.deepEqual(fs.readdirSync(backup),[]);assert.deepEqual(fs.readdirSync(root).sort(),['app.asar','backup','host.exe'])}
 assert.equal(spawnSync(process.execPath,[cli,'--asar',archive,'--electron-exe',exe,'--apply'],{encoding:'utf8'}).status,2)
})
