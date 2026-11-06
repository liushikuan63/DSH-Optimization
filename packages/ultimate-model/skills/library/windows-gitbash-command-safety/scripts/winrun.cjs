#!/usr/bin/env node
'use strict';
// Run a Windows-native exe from an MSYS shell without switch mangling, decode
// cp936 output, and print a bounded summary. Usage:
//   node winrun.cjs <exe> [args...] [--out f] [--lines N] [--no-resolve]
//                   [--gbk] [--utf8] [--winpath]
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Commands whose MSYS/coreutils twin shadows the System32 original.
const SHADOWED = ['whoami', 'find', 'sort', 'expr', 'path', 'echo'];
const FLAGS = new Set(['--out', '--lines']);
const BOOLS = new Set(['--no-resolve', '--gbk', '--utf8', '--winpath']);

function parse(argv) {
  const opt = { out: null, lines: 12, resolve: true, force: null, winpath: false, exe: null, args: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { rest.push(...argv.slice(i + 1)); break; }
    if (FLAGS.has(a)) { opt[a === '--out' ? 'out' : 'lines'] = argv[++i]; continue; }
    if (BOOLS.has(a)) {
      if (a === '--no-resolve') opt.resolve = false;
      else if (a === '--gbk') opt.force = 'gbk';
      else if (a === '--utf8') opt.force = 'utf8';
      else opt.winpath = true;
      continue;
    }
    rest.push(a);
  }
  if (!rest.length) return null;
  opt.exe = rest[0];
  opt.args = rest.slice(1);
  opt.lines = Math.max(0, parseInt(opt.lines, 10) || 0);
  return opt;
}

function winPath(p) {
  const cp = spawnSync('cygpath', ['-w', p], { encoding: 'utf8' });
  if (cp.status === 0 && String(cp.stdout || '').trim()) return String(cp.stdout).trim();
  if (p === '/tmp' || p.startsWith('/tmp/')) {
    return path.win32.join(path.win32.parse(process.env.TEMP || require('os').tmpdir()).dir,
      path.win32.basename(process.env.TEMP || require('os').tmpdir()), p.slice(5));
  }
  const m = /^\/([a-zA-Z])\/?(.*)$/.exec(p);
  if (m) return m[1].toUpperCase() + ':\\' + (m[2] || '').replace(/\//g, '\\');
  return p;
}

function decode(buf, force) {
  if (force === 'gbk') return { text: toGbk(buf), how: 'gbk(forced)' };
  if (force === 'utf8') return { text: buf.toString('utf8'), how: 'utf8(forced)' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), how: 'utf8' };
  } catch (e) {
    return { text: toGbk(buf), how: 'gbk' };
  }
}

function toGbk(buf) {
  try {
    return new TextDecoder('gbk').decode(buf);
  } catch (e) {
    return buf.toString('latin1') + '\n[WARN: gbk decoder unavailable on this node build]';
  }
}

function resolveExe(name) {
  const base = name.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
  if (!SHADOWED.includes(base.toLowerCase())) return name;
  const sys32 = path.win32.join(process.env.WINDIR || 'C:\\Windows', 'System32', base + '.exe');
  return fs.existsSync(sys32) ? sys32 : name;
}

function foldSwitch(a) {
  // bash folds a leading `//x` into `/x` before exec; node does not, so cmd
  // would see `//c` as a bad switch, print its banner and still exit 0.
  return /^\/\/[A-Za-z][A-Za-z0-9_-]*$/.test(a) ? a.slice(1) : a;
}

function main() {
  const opt = parse(process.argv.slice(2));
  if (!opt) {
    console.log('USAGE: node winrun.cjs <exe> [args...] [--out f] [--lines N] [--no-resolve] [--gbk|--utf8] [--winpath]');
    process.exit(1);
  }
  const args = opt.args.map(a => foldSwitch(a)).map(a => (opt.winpath && /^\/(tmp|[a-zA-Z]\/)/.test(a) ? winPath(a) : a));
  const exe = opt.resolve ? resolveExe(opt.exe) : opt.exe;
  const env = Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1', MSYS2_ARG_CONV_EXCL: '*' });
  const r = spawnSync(exe, args, { env, maxBuffer: 64 * 1024 * 1024, windowsVerbatimArguments: true });
  if (r.error) {
    console.log('EXIT=spawn-failed');
    console.log('ERR=' + r.error.message);
    process.exit(127);
  }
  const raw = Buffer.concat([r.stdout || Buffer.alloc(0), r.stderr || Buffer.alloc(0)]);
  const d = decode(raw, opt.force);
  const out = opt.out || path.win32.join(process.env.TEMP || require('os').tmpdir(), 'winrun.last.txt');
  fs.writeFileSync(out, d.text, { encoding: 'utf8' });
  const body = d.text.replace(/\r\n/g, '\n').split('\n');
  console.log('EXIT=' + (r.status === null ? 'signal' : r.status));
  console.log('REAL=' + exe);
  console.log('DECODED=' + d.how);
  console.log('BYTES=' + raw.length + ' LINES=' + body.length);
  console.log('OUT=' + out);
  console.log('---');
  console.log(body.slice(0, opt.lines).join('\n'));
  if (body.length > opt.lines) console.log('... (' + (body.length - opt.lines) + ' more lines in OUT)');
  process.exit(r.status === null ? 1 : r.status);
}

if (require.main === module) main();
module.exports = { decode, winPath, resolveExe, SHADOWED };
