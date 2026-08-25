import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const excluded = new Set(['node_modules', 'lib', 'site-dist', '.git', 'coverage', '.e2e-home'])
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.css', '.html', '.txt'])
const files = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (textExtensions.has(extname(entry.name)) || entry.name === 'LICENSE' || entry.name === '.gitignore' || entry.name === '.npmignore') files.push(path)
  }
}
await walk(root)
const forbidden = [
  { pattern: /\/Users\/[A-Za-z0-9._-]+\//, label: 'macOS home path' },
  { pattern: /[A-Za-z]:\\Users\\[^\\]+\\/i, label: 'Windows home path' },
  { pattern: /(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*["'][^"']{12,}["']/i, label: 'possible credential' },
  { pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, label: 'private key' },
]
for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const rule of forbidden) if (rule.pattern.test(source)) throw new Error(`${relative(root, file)}: contains ${rule.label}`)
}
console.log(`checked ${files.length} public text files`)
