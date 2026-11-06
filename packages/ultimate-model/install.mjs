// Compatibility preview only. Installation belongs to the official profile manager.
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const args=process.argv.slice(2)
if(args.some(a=>['--apply','--force','--force-rules','--with-mcp'].includes(a))){console.error('REFUSED: legacy home/config rewriting is disabled. Use plugin_manager install_bundle with this package directory; MCP requires separate explicit setup.');process.exitCode=2}
else{
 const root=path.dirname(fileURLToPath(import.meta.url))
 console.log(JSON.stringify({dryRun:true,package:'@local/ultimate-model',directory:root,preset:'ultimate-model',writes:[],next:'plugin_manager action=install_bundle target=<absolute package directory>',notice:'No home files, presets, credentials or MCP settings are changed by this preview.'},null,2))
}
