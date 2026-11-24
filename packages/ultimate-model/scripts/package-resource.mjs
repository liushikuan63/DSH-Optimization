import path from 'node:path'

export function compositionChildren(row) {
  // Presets carry plugins in an object; Cordis groups carry rows directly
  // in config. Other plugins can have config arrays that are plain data.
  if (row?.group === true && row.name === 'cordis:group' && Array.isArray(row.config)) return row.config
  return Array.isArray(row?.config?.plugins) ? row.config.plugins : []
}

// Recognize the distributed resolver as data, never as executable JavaScript.
const RESOLVER = /^\(\(\)\s*=>\s*\{\s*const path = process\.getBuiltinModule\("node:path"\);\s*const \{ createRequire \} = process\.getBuiltinModule\("node:module"\);\s*const root = path\.dirname\(createRequire\(baseUrl\)\.resolve\("@local\/ultimate-model\/package\.json"\)\);\s*return path\.join\(root, "(\.\/[A-Za-z0-9_./-]+)"\);\s*\}\)\(\)$/

export function resolvePackageExpression(expression, root) {
  const match = typeof expression === 'string' ? RESOLVER.exec(expression.trim()) : null
  if (!match) throw new Error('UNSUPPORTED_PACKAGE_RESOLVER')
  const relative = match[1].slice(2)
  if (relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('UNSAFE_PACKAGE_RESOURCE')
  return path.resolve(root, relative)
}
