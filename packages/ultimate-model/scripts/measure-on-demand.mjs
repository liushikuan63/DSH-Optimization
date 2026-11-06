import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { search } from './skill-load.mjs'
import { collect } from './build-skills-index.mjs'
import { CONTEXT_PROMPT } from '../plugins/context-checkpoint/index.mjs'
import { EXPERIENCE_PROMPT } from '../plugins/experience-loop/index.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url), yaml = require('../vendor/js-yaml.js')
const patch = yaml.load(fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8'))
const rows = patch[0].insert[0].config.plugins
const measure = text => ({ utf8Bytes: Buffer.byteLength(text), lines: text.split(/\r?\n/).length })
const percentile = (values, p) => values[Math.ceil(values.length * p) - 1]
const timings = {}
for (const query of ['cordis', 'context-checkpoint', 'office', 'does-not-exist-zz991']) {
 const samples = []; let results
 for (let i = 0; i < 31; i++) { const start = performance.now(); results = search(query, { bundleRoot: root }); samples.push(performance.now() - start) }
 const hot = samples.slice(1).sort((a, b) => a - b)
 timings[query] = { hits: results.length, firstMs: samples[0], medianMs: percentile(hot, 0.5), p95Ms: percentile(hot, 0.95), runs: samples.length }
}
const skills = collect({ bundleRoot: root }), coreMetadata = skills.filter(s => s.tier !== 'library').map(s => s.name + ': ' + s.description).join('\n')
console.log(JSON.stringify({ version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version,
 context: { persona: measure(rows.find(r => r.id === 'persona').config.prefix), checkpointReminder: measure(CONTEXT_PROMPT), experienceReminder: measure(EXPERIENCE_PROMPT), bundleCatalogMetadata: measure(coreMetadata), onDemandKernelBody: measure(fs.readFileSync(path.join(root, 'preset/skills/jizhi-mode/SKILL.md'), 'utf8')) },
 timings, scope: 'Actual filesystem search. First call is not an OS cold-cache guarantee. Excludes Host Inspect, model roundtrips and provider token billing; actual native wire is measured separately.' }, null, 2))
