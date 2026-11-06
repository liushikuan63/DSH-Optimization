// Optional legacy hook bridge: pure preflight only; no command execution.
import { decide } from './index.js'
const chunks=[];let length=0
try {
 for await(const chunk of process.stdin){length+=chunk.length;if(length>65536)throw Error('Guard payload exceeds 64 KiB');chunks.push(chunk)}
 const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'))
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.tool_name!=='string'||!payload.tool_name.trim()||!payload.tool_input||typeof payload.tool_input!=='object'||Array.isArray(payload.tool_input))throw Error('Invalid guard input')
 const reason=decide(payload.tool_name,payload.tool_input)
 process.stdout.write(JSON.stringify({reason}))
} catch {
 process.stdout.write(JSON.stringify({reason:'安全判定输入/执行异常；本次调用未执行，先修复守卫。'}))
 process.exitCode=1
}
