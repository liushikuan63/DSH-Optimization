import path from 'node:path'

// Recognize the distributed resolver as data, never as executable JavaScript.
const RESOLVER = /^\(\(\)\s*=>\s*\{\s*const path = process\.getBuiltinModule\("node:path"\);\s*const \{ createRequire \} = process\.getBuiltinModule\("node:module"\);\s*const root = path\.dirname\(createRequire\(baseUrl\)\.resolve\("@local\/ultimate-model\/package\.json"\)\);\s*return path\.join\(root, "(\.\/[A-Za-z0-9_./-]+)"\);\s*\}\)\(\)$/

export function resolvePackageExpression(expression, root) {
  const match = typeof expression === 'string' ? RESOLVER.exec(expression.trim()) : null
  if (!match) throw new Error('UNSUPPORTED_PACKAGE_RESOLVER')
  const relative = match[1].slice(2)
  if (relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('UNSAFE_PACKAGE_RESOURCE')
  return path.resolve(root, relative)
}
