import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {validateBundle} from './validate-bundle.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
try{
 console.log(JSON.stringify(validateBundle(root),null,2))
 if(process.argv.includes('--tests')){
  if(!process.env.SKILL_INDEX_TEST_TMPDIR)throw Error('Set SKILL_INDEX_TEST_TMPDIR to an existing temporary directory outside the user home before running tests.')
  const temporary=fs.realpathSync(process.env.SKILL_INDEX_TEST_TMPDIR)
  const relative=path.relative(fs.realpathSync(os.homedir()),temporary)
  if(!fs.statSync(temporary).isDirectory()||!(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)))throw Error('Test temporary root must be outside user home')
  const environment={...process.env,SKILL_INDEX_TEST_TMPDIR:temporary,TEMP:temporary,TMP:temporary,TMPDIR:temporary}
  const collectTests=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collectTests(path.join(directory,entry.name)):entry.name.endsWith('.test.mjs')?[path.join(directory,entry.name)]:[])
  const files=collectTests(path.join(root,'tests')).sort()
  const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit',cwd:root,env:environment})
  if(result.error)throw result.error
  if(result.status!==0)process.exitCode=result.status||1
 }
}catch(error){console.error('FAIL: '+error.message);process.exitCode=1}
