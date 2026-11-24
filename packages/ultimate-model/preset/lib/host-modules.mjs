import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

/** Resolve the current installation's SDK, never a second copy from an addon. */
export function hostModules(ctx) {
  const anchor = ctx.get('profileContext')?.installAnchor
  if (!anchor) throw new Error('Ultimate Model: the Host did not expose profileContext.installAnchor')
  const resolve = createRequire(anchor).resolve
  return { resolve, import: name => import(pathToFileURL(resolve(name)).href) }
}
