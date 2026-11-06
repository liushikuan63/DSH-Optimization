import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {pathToFileURL} from 'node:url'
const tmp=path.resolve(process.env.SKILL_INDEX_TEST_TMPDIR||os.tmpdir()),rel=path.relative(os.homedir(),tmp)
if(!rel||(!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel)))throw Error('Use an isolated temporary directory outside user home')
const root=fs.mkdtempSync(path.join(tmp,'guard-contract-'))
process.env.DSH_HOME=root
const {decide}=await import(process.env.GUARD_TEST_TARGET?pathToFileURL(process.env.GUARD_TEST_TARGET):new URL('../plugins/hook-guards-native/index.js',import.meta.url))
const credential=path.join(root,'.credentials.yaml'),source=path.join(root,'owned-source.txt'),virtual=path.join(root,'never-executed-target')
fs.writeFileSync(source,'x'.repeat(42000))
const denied=(tool,args)=>assert.equal(typeof decide(tool,args),'string')
const allowed=(tool,args)=>assert.equal(decide(tool,args),null)
test('actual SDK editor mutation commands use path and retain credential write protection',()=>{
 for(const command of ['create','str_replace','insert','future_mutation'])denied('str_replace_editor',{command,path:credential,file_text:'fixture',old_str:'fixture',new_str:'fixture'})
 allowed('str_replace_editor',{command:'create',path:path.join(root,'ordinary-source.js'),file_text:'fixture'})
})
test('actual SDK editor view applies credential read and bounded large-file rules',()=>{
 denied('str_replace_editor',{command:'view',path:credential,view_range:[1,10]})
 for(const view_range of [undefined,[1,-1],[1,201]])denied('str_replace_editor',{command:'view',path:source,view_range})
 for(const view_range of [[1,200],[11,210]])allowed('str_replace_editor',{command:'view',path:source,view_range})
})
test('explicit recursive deletion is refused across actual bash/win_bash/pwsh forms',()=>{
 for(const shell of ['bash','win_bash'])for(const command of [`rm -r -- '${virtual}'`,`rm --recursive '${virtual}'`,`rm -rf '${virtual}'`])denied(shell,{command})
 for(const command of [`Remove-Item -LiteralPath '${virtual}' -Recurse`,`Remove-Item -LiteralPath '${virtual}' -Recurse -Force`,`ri -LiteralPath '${virtual}' -Recurse -Force`,`rm -LiteralPath '${virtual}' -Recurse`,`Remove-Item -r '${virtual}'`])denied('pwsh',{command})
 denied('win_bash',{command:`cmd /c rmdir /s '${virtual}'`})
 denied('bash',{command:`bash -lc "rm -r '${virtual}'"`})
})
test('ordinary nonrecursive operations and literal read-only command examples remain available',()=>{
 for(const command of [`rm -- '${virtual}'`,`rm -f -- '${virtual}'`,`rmdir '${virtual}'`])allowed('bash',{command})
 for(const command of [`Remove-Item -LiteralPath '${virtual}'`,`Remove-Item -LiteralPath '${virtual}' -Force`,`Remove-Item -LiteralPath '${virtual}' -Recurse:$false`,`Write-Output 'Remove-Item -Recurse -Force example'`])allowed('pwsh',{command})
 for(const command of [`echo 'rm -rf example'`,`printf '%s' 'rm -r *.log'`,`grep 'rm -rf example' '${source}' | head -10`])allowed('bash',{command})
})
