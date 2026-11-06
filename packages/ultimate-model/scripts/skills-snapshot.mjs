// Read-only metadata snapshot for the weekly audit. No cached index or build.
import {collect,parseCli} from './build-skills-index.mjs'
try {
 const {options}=parseCli(process.argv.slice(2))
 const entries=collect(options)
 process.stdout.write(JSON.stringify({count:entries.length,entries:entries.map(({name,path,description,source,tier})=>({name,path,description,source,tier})),note:'Scanned personal/project filesystem roots; not the live host catalog.'}))
} catch(error){console.error('ERROR: '+error.message);process.exitCode=2}
