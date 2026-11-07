'use strict';
// Exact SDK0.2.1-rc.3 standing subagent composition lifetime repair.
// Data-only transformation; no application module is imported or executed.
const {createHash}=require('node:crypto');
const FILE='node_modules/@deepseek-ai/dsh-tool-subagent/lib/index.js';
const BEFORE='de7b10aaf52b1b1616d13a831a9ece1f820b8a6302fe94667f31b6d641b2f46e';
const AFTER='315ab11c1d2afb831a451b3cfc126a7686e9d09fe5012295fe64990a4c021082';
const replacements=Object.freeze([
  {
    "label": "track scoped child fibers owned by this standing composition",
    "from": "\tconst scopedInstalls = /* @__PURE__ */ new WeakMap();\n\tconst installing = /* @__PURE__ */ new WeakSet();",
    "to": "\tconst scopedInstalls = /* @__PURE__ */ new WeakMap();\n\tconst ownedScopedInstalls = /* @__PURE__ */ new Set();\n\tlet closing = false;\n\tconst installing = /* @__PURE__ */ new WeakSet();"
  },
  {
    "label": "stop accepting new scoped installs during owner teardown",
    "from": "\tconst installScoped = (candidate) => {\n\t\tconst existing = scopedInstalls.get(candidate);",
    "to": "\tconst installScoped = (candidate) => {\n\t\tif (closing) return;\n\t\tconst existing = scopedInstalls.get(candidate);"
  },
  {
    "label": "do not mount after asynchronous preset validation outlives owner",
    "from": "\t\t\t\tif (presets.configured) await presets.validate(ctx);\n\t\t\t\tinstall(runtimeCtx, policy);",
    "to": "\t\t\t\tif (presets.configured) await presets.validate(ctx);\n\t\t\t\tif (closing) return;\n\t\t\t\tinstall(runtimeCtx, policy);"
  },
  {
    "label": "retain each child until its real disposal completes",
    "from": "\t\tscopedInstalls.set(candidate, fiber);\n\t\treturn fiber;",
    "to": "\t\tscopedInstalls.set(candidate, fiber);\n\t\townedScopedInstalls.add(fiber);\n\t\treturn fiber;"
  },
  {
    "label": "remove completed child from owner inventory without hiding rejection",
    "from": "\t\tfiber.dispose().catch((error) => {",
    "to": "\t\tfiber.dispose().finally(() => ownedScopedInstalls.delete(fiber)).catch((error) => {"
  },
  {
    "label": "await all actual children on standing owner disposal and preserve first rejection",
    "from": "\tctx.on(\"tools/change\", reconcileComposedAgents);\n\treconcileComposedAgents();",
    "to": "\tctx.on(\"tools/change\", reconcileComposedAgents);\n\tctx.effect(() => async () => {\n\t\tclosing = true;\n\t\tconst settled = await Promise.allSettled([...ownedScopedInstalls].map((fiber) => Promise.resolve().then(() => fiber.dispose())));\n\t\townedScopedInstalls.clear();\n\t\tconst failure = settled.find((result) => result.status === \"rejected\");\n\t\tif (failure !== void 0) throw failure.reason;\n\t}, \"tool-subagent scoped ownership\");\n\treconcileComposedAgents();"
  }
]).map(Object.freeze);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function transform(bytes,reverse){
 if(!Buffer.isBuffer(bytes))throw new TypeError('SUBAGENT_SOURCE_REQUIRES_BUFFER');
 if(hash(bytes)!==(reverse?AFTER:BEFORE))throw new Error('UNSUPPORTED_SUBAGENT_SOURCE');
 let text=bytes.toString('utf8');
 for(const part of reverse?[...replacements].reverse():replacements){const from=reverse?part.to:part.from,to=reverse?part.from:part.to;if(text.split(from).length!==2)throw new Error('SUBAGENT_REPLACEMENT_NOT_UNIQUE');text=text.replace(from,to)}
 const next=Buffer.from(text,'utf8');if(hash(next)!==(reverse?BEFORE:AFTER))throw new Error('SUBAGENT_RESULT_HASH_MISMATCH');return next;
}
module.exports=Object.freeze({FILE,BEFORE,AFTER,replacementCount:replacements.length,buildCandidate:bytes=>transform(bytes,false),restoreOriginal:bytes=>transform(bytes,true)});
