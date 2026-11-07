import { createHash } from 'node:crypto';

export const SOURCE_PINS = Object.freeze({
  before: '1ae5f487d7d8304c5b20321280bc76b11fc8500ad1b599237e00858b38061e0c',
  after: '680d4dbd4594145c92a7a571ce044862f8bd326bc839873ff13653c4e8e50f46',
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Pure, version-pinned data transform; never imports or evaluates target source. */
export function transformDshFooterSource(input) {
  if (!Buffer.isBuffer(input)) throw new TypeError('DSH_FOOTER_BUFFER_REQUIRED');
  if (sha256(input) !== SOURCE_PINS.before) throw new Error('DSH_FOOTER_SOURCE_PIN');
  const eol = input.includes(Buffer.from('\r\n')) ? '\r\n' : '\n';
  let source = input.toString('utf8').replaceAll('\r\n', '\n');
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('DSH_FOOTER_UNIQUE_ANCHOR');
    source = source.replace(before, after);
  };
  // clientWidth includes the existing 8px padding; contentRect.width does not.
  replace('const containerWidth = Math.max(rawWidth - 8, 120);',
    'const containerWidth = Math.max(knownSlotWidth ? rawWidth : rawWidth - 8, 120);');
  // Preserve this explanatory comment in the fixed output, without touching other code.
  replace('\t\t\tconst containerWidth = Math.max(knownSlotWidth ? rawWidth : rawWidth - 8, 120);',
    '\t\t\t// ResizeObserver contentRect already excludes the slot\'s horizontal padding.\n\t\t\tconst containerWidth = Math.max(knownSlotWidth ? rawWidth : rawWidth - 8, 120);');
  replace('\t\t\tconst resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => {\n\t\t\t\tfor (const entry of entries) if (entry.target instanceof HTMLElement) balanceSidebarFooterSlot(entry.target, Math.floor(entry.contentRect?.width ?? 0));\n\t\t\t}) : null;',
`\t\t\tlet disposed = false;
\t\t\tlet resizeFrame = null;
\t\t\tconst pendingResizeSlots = new Map();
\t\t\tconst resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => {
\t\t\t\tif (disposed) return;
\t\t\t\tfor (const entry of entries) if (entry.target instanceof HTMLElement) pendingResizeSlots.set(entry.target, Math.floor(entry.contentRect?.width ?? 0));
\t\t\t\tif (resizeFrame !== null || pendingResizeSlots.size === 0) return;
\t\t\t\t// Leave the observer delivery cycle before changing grid geometry.
\t\t\t\tresizeFrame = requestAnimationFrame(() => {
\t\t\t\t\tresizeFrame = null;
\t\t\t\t\tif (disposed) return;
\t\t\t\t\tconst pending = Array.from(pendingResizeSlots);
\t\t\t\t\tpendingResizeSlots.clear();
\t\t\t\t\tfor (const [slot, width] of pending) if (slot.isConnected) balanceSidebarFooterSlot(slot, width);
\t\t\t\t});
\t\t\t}) : null;`);
  replace('\t\t\t\tif (scheduled) return;', '\t\t\t\tif (disposed || scheduled) return;');
  replace('\t\t\t\t\trefresh();\n\t\t\t\t});', '\t\t\t\t\tif (!disposed) refresh();\n\t\t\t\t});');
  replace('\t\t\treturn () => {\n\t\t\t\tbootstrapObserver?.disconnect();',
    '\t\t\treturn () => {\n\t\t\t\tdisposed = true;\n\t\t\t\tif (resizeFrame !== null) cancelAnimationFrame(resizeFrame);\n\t\t\t\tresizeFrame = null;\n\t\t\t\tpendingResizeSlots.clear();\n\t\t\t\tbootstrapObserver?.disconnect();');
  const output = Buffer.from(source.replaceAll('\n', eol));
  if (sha256(output) !== SOURCE_PINS.after) throw new Error('DSH_FOOTER_OUTPUT_PIN');
  return output;
}
