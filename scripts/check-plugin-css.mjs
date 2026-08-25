import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const directory = new URL('../src/client/', import.meta.url)
const files = (await readdir(directory)).filter(name => name.endsWith('.module.css'))
if (files.length === 0) throw new Error('no CSS Module files found')
for (const file of files) {
  const source = await readFile(new URL(file, directory), 'utf8')
  if (/#[0-9a-f]{3,8}\b/i.test(source)) throw new Error(`${file}: fixed hexadecimal color is forbidden`)
  if (/\b(?:rgb|rgba|hsl|hsla)\s*\(/i.test(source)) throw new Error(`${file}: fixed RGB/HSL color is forbidden`)
  if (!source.includes('var(--dsw-')) throw new Error(`${file}: expected official --dsw-* semantic variables`)
}
console.log(`checked ${files.length} CSS Modules`)
