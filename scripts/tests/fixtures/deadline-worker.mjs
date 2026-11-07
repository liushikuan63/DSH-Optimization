import fs from 'node:fs';
import path from 'node:path';
import {runGuard} from '../../lib/diagnostic-deadline.mjs';
import {FixtureBackend} from './deadline-backend.mjs';
const plan=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const marker=JSON.parse(fs.readFileSync(path.join(plan.fixtureRoot,'fixture-owner.json'),'utf8'));
fs.writeFileSync(path.join(plan.fixtureRoot,'worker.json'),JSON.stringify({nonce:marker.nonce,pid:process.pid}));
try{const result=await runGuard(plan,new FixtureBackend(plan));process.exitCode=result.status==='PASS'?0:1;}
catch(e){fs.writeFileSync(path.join(plan.fixtureRoot,'setup-error.json'),JSON.stringify({code:e.code||'UNKNOWN'}));process.exitCode=2;}
