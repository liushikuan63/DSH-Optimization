import os from 'node:os'
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
export const actorHash = 'a'.repeat(64);
export const sameId = (a,b) => a.dev === b.dev && a.ino === b.ino;
export async function fixture(t) {
  const root = await fs.mkdtemp(path.join(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir(), 'dsh-local-memory-store-fixture-'));
  const files = new Map(), dirs = new Map([[root,await fs.lstat(root,{bigint:true})]]);
  const inside = value => { const rel=path.relative(root,value);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel),'Only this registered fixture'); };
  // Explicit calls are made only by the test that created/moved that logical name.
  const ownFile = async file => {inside(file);files.set(file,await fs.lstat(file,{bigint:true}));};
  const ownDir = async dir => {inside(dir);dirs.set(dir,await fs.lstat(dir,{bigint:true}));};
  const local = path.join(root,'.dsh','local-memory'), store = path.join(local,'store-v1.json'), lock = path.join(local,'store-v1.lock');
  // Anti-replay only: trusted test callers supply real receipts. This does not authenticate
  // arbitrary JSON or rule out an identical-byte swap before the first capture.
  const consumedReceipts=new WeakSet(), consumedCommits=new Set();
  const capture = async receipt => {
    if(receipt?.committed===true){
      assert.ok(typeof receipt==='object'&&receipt!==null&&typeof receipt.id==='string'&&Number.isSafeInteger(receipt.revision)&&receipt.revision>=1,'Fixture receipt shape');
      const commitKey=receipt.id+':'+receipt.revision;
      assert.ok(!consumedReceipts.has(receipt)&&!consumedCommits.has(commitKey),'Fixture receipt replay rejected');
      consumedReceipts.add(receipt);consumedCommits.add(commitKey);
    }
    for (const dir of [path.join(root,'.dsh'),local]) {
      const s = await fs.lstat(dir,{bigint:true}).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(!s || !s.isDirectory() || s.isSymbolicLink()) return;
      if(dirs.has(dir)) assert.ok(sameId(s,dirs.get(dir)),'Unexpected fixture directory identity'); else dirs.set(dir,s);
    }
    for(const leaf of await fs.readdir(local)) {
      const file=path.join(local,leaf),current=await fs.lstat(file,{bigint:true});
      if(file===store && receipt?.committed===true) {
        assert.ok(current.isFile()&&!current.isSymbolicLink()&&current.nlink===1n,'Commit must be a private regular file');
        assert.equal(receipt.trust,'unverified-submitter-claim');
        const data=JSON.parse(await fs.readFile(file,'utf8'));
        assert.ok(data.pages.some(p=>p.id===receipt.id&&p.revision===receipt.revision),'Disk must match the successful commit receipt');
        files.set(file,current); // sole automatic transfer: confirmed explicit commit, never t.after
      } else {
        assert.ok(files.has(file),'Unregistered fixture file: test must explicitly own its created foreign name');
        assert.ok(sameId(current,files.get(file)),'Unexpected fixture file replacement; capture cannot adopt it');
      }
    }
  };
  t.after(async()=>{
    // Never discover or refresh ownership here. Unknown replacements must survive.
    const unlink=[];
    for(const [file,id]of files){const s=await fs.lstat(file,{bigint:true}).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(s){assert.ok(sameId(s,id),'Foreign replacement preserved');unlink.push(file);}}
    for(const file of unlink)await fs.unlink(file);
    for(const [dir,id]of [...dirs].sort((a,b)=>b[0].length-a[0].length)){const s=await fs.lstat(dir,{bigint:true}).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(s){assert.ok(sameId(s,id)&&s.isDirectory()&&!s.isSymbolicLink(),'Foreign directory preserved');await fs.rmdir(dir);}}
  });
  return {root,local,store,lock,capture,ownFile,ownDir,files,dirs,async exists(file=store){try{await fs.lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}};
}
