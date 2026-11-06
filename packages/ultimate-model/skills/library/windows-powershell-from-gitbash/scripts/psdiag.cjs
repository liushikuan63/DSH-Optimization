#!/usr/bin/env node
// Run a .ps1 from a POSIX shell without letting that shell touch its contents,
// and capture its output as plain UTF-8 (PowerShell 5.1 streams UTF-8 or GBK
// depending on the stream, and its redirection operators write UTF-16).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const decode = (buf) => {
  if (!buf || !buf.length) return '';
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch (e2) {
      return buf.toString('utf8');
    }
  }
};

module.exports = { decode };

function main() {
  const argv = process.argv.slice(2);
  const getOpt = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  const ps1 = argv.find((a) => !a.startsWith('--'));
  if (!ps1) {
    console.log('usage: node psdiag.cjs <script.ps1> [--out <file>] [--lines N]');
    process.exit(2);
  }
  if (!fs.existsSync(ps1)) {
    console.log('NOT FOUND: ' + ps1);
    process.exit(2);
  }

  const winPath = path.resolve(ps1).replace(/\//g, '\\');
  const outFile = getOpt('--out', ps1.replace(/\.ps1$/i, '') + '.out.txt');
  const maxLines = Number(getOpt('--lines', 40)) || 40;

  // -File (not -Command): a script that fails to parse must exit non-zero. Wrapping
  // it in `-Command "& 'x.ps1'; exit $LASTEXITCODE"` reports EXIT=0 for a script
  // that never ran.
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', winPath], {
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (r.error) {
    console.log('FATAL: ' + r.error.message);
    process.exit(2);
  }

  const stdout = decode(r.stdout);
  const stderr = decode(r.stderr);
  const text = stdout + (stderr ? '\n----- STDERR -----\n' + stderr : '');
  fs.writeFileSync(outFile, text.replace(/^\uFEFF/, ''), 'utf8');

  const lines = text.split(/\r?\n/);
  console.log('EXIT=' + (r.status === null ? 'signal:' + r.signal : r.status));
  console.log('OUT=' + path.resolve(outFile) + ' (' + Buffer.byteLength(text) + ' bytes, ' + lines.length + ' lines)');
  console.log('DECODED=' + (/\uFFFD/.test(text) ? 'lossy (unmappable bytes remain)' : 'clean'));
  if (!stdout.trim() && !stderr.trim() && r.status === 0) {
    console.log('WARN: exit 0 with no output - the script may not have run at all');
  }
  console.log('----- lines 1-' + Math.min(maxLines, lines.length) + ' -----');
  console.log(lines.slice(0, maxLines).join('\n'));
  if (lines.length > maxLines) console.log('... (' + (lines.length - maxLines) + ' more lines in ' + outFile + ')');
}

if (require.main === module) main();
