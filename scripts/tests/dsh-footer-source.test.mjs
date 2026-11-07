import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_PINS, transformDshFooterSource } from '../lib/dsh-footer-source.mjs';

test('pins are immutable full SHA256 values', () => {
  assert.equal(Object.isFrozen(SOURCE_PINS), true);
  assert.match(SOURCE_PINS.before, /^[a-f0-9]{64}$/);
  assert.match(SOURCE_PINS.after, /^[a-f0-9]{64}$/);
  assert.notEqual(SOURCE_PINS.before, SOURCE_PINS.after);
});
test('rejects non Buffer input instead of coercing arbitrary objects', () => {
  for (const input of [null, undefined, 'source', new Uint8Array(1), {}]) {
    assert.throws(() => transformDshFooterSource(input), /DSH_FOOTER_BUFFER_REQUIRED/);
  }
});
test('unknown or locally modified bytes fail closed without modifying input', () => {
  const input = Buffer.from('/* local changes must survive */');
  const snapshot = Buffer.from(input);
  assert.throws(() => transformDshFooterSource(input), /DSH_FOOTER_SOURCE_PIN/);
  assert.deepEqual(input, snapshot);
});
test('source bytes are treated only as data, never evaluated', () => {
  const input = Buffer.from('throw new Error("TARGET_EXECUTED")');
  assert.throws(() => transformDshFooterSource(input), /DSH_FOOTER_SOURCE_PIN/);
});
