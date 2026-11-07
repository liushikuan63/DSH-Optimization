'use strict';
// Ownership-only compatibility repair for the exact bundled Cordis 4.0.5 source.
// Retains the original parallel cleanup order needed by the existing Peer abort contract.
// Adapted from the ownership concept in deepseek-ai/deepseek-harness commit
// a91a827546727057a4e0d05b7fa59ff5c5138be1; this is not an SDK/core upgrade.
const { createHash } = require('node:crypto');
const FILE = 'node_modules/@deepseek-ai/cordis/lib/index.js';
const BEFORE = "6a9394c0877ff45218818c6e815edd038f8057e1a1deb390a8d43ec81c57691e";
const AFTER = "a580c0f17ff210b5b80d48a888aa5e842de2c743a0a94f2d53f795803ada9d8d";
const replacements = Object.freeze([
  {
    "label": "track consumers of a particular implementation",
    "from": "\t\t\t\tfiber: this.ctx.fiber,\n\t\t\t\tcheck\n\t\t\t};",
    "to": "\t\t\t\tfiber: this.ctx.fiber,\n\t\t\t\tcheck,\n\t\t\t\tdependents: new Set()\n\t\t\t};"
  },
  {
    "label": "withdraw waits for committed consumers rather than unrelated notified generations",
    "from": "\t\t\t\tdelete this.store[key];\n\t\t\t\tconst fibers = this.notify([name]);\n\t\t\t\tawait Promise.allSettled(fibers.map((fiber) => fiber.await()));\n\t\t\t\tdelete this.ctx.fiber.store[name];",
    "to": "\t\t\t\tif (this.store[key] === impl) delete this.store[key];\n\t\t\t\tthis.notify([name]);\n\t\t\t\tawait new Promise((resolve) => {\n\t\t\t\t\timpl.release = resolve;\n\t\t\t\t\tif (!impl.dependents.size) resolve();\n\t\t\t\t});\n\t\t\t\timpl.release = void 0;\n\t\t\t\tif (this.ctx.fiber.store?.[name] === impl) delete this.ctx.fiber.store[name];"
  },
  {
    "label": "separate the committed dependency snapshot from mutable public store",
    "from": "\t_store = Object.create(null);\n\t/**",
    "to": "\t_store = Object.create(null);\n\t// Fixed per-activation implementations; provide() may mutate public store.\n\t_dependencies;\n\t/**"
  },
  {
    "label": "register the implementations actually committed by this activation",
    "from": "\tasync _reload() {\n\t\tthis.store = { ...this._store };\n\t\tconst oldEpoch = this._runner.epoch;",
    "to": "\tasync _reload() {\n\t\tthis.store = { ...this._store };\n\t\tthis._dependencies = new Set(Object.values(this.store).filter((impl) => impl.fiber !== this));\n\t\tfor (const impl of this._dependencies) impl.dependents.add(this);\n\t\tconst oldEpoch = this._runner.epoch;"
  },
  {
    "label": "retain cleanup promises for complete settlement on unexpected logger failure",
    "from": "\tasync _unload() {\n\t\tawait Promise.all(this._disposables.clear().map(async (dispose) => {",
    "to": "\tasync _unload() {\n\t\tconst cleanup = this._disposables.clear().map(async (dispose) => {"
  },
  {
    "label": "release the committed snapshot even if logging throws, after every cleanup settles",
    "from": "\t\t}));\n\t\tthis.store = void 0;\n\t\tthis._updateState(() => {",
    "to": "\t\t});\n\t\ttry {\n\t\t\tawait Promise.all(cleanup);\n\t\t} catch (error) {\n\t\t\t// Preserve the original first rejection, but release no dependency while\n\t\t\t// another cleanup is still using it (a logger exporter can also throw).\n\t\t\tawait Promise.allSettled(cleanup);\n\t\t\tthrow error;\n\t\t} finally {\n\t\t\tfor (const impl of this._dependencies ?? []) {\n\t\t\t\tif (!impl.dependents.delete(this) || impl.dependents.size) continue;\n\t\t\t\timpl.release?.();\n\t\t\t}\n\t\t\tthis._dependencies = void 0;\n\t\t}\n\t\tthis.store = void 0;\n\t\tthis._updateState(() => {"
  }
].map(Object.freeze));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function buildCandidate(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("CORDIS_SOURCE_REQUIRES_BUFFER");
  if (sha256(bytes) !== BEFORE) throw new Error("UNSUPPORTED_CORDIS_SOURCE");
  let text = bytes.toString("utf8");
  for (const { from, to } of replacements) {
    if (text.split(from).length !== 2) throw new Error("CORDIS_REPLACEMENT_NOT_UNIQUE");
    text = text.replace(from, to);
  }
  const candidate = Buffer.from(text, "utf8");
  if (sha256(candidate) !== AFTER) throw new Error("CORDIS_CANDIDATE_HASH_MISMATCH");
  return candidate;
}
module.exports = Object.freeze({ FILE, BEFORE, AFTER, replacementCount: replacements.length, buildCandidate });
