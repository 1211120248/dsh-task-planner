import { rmSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../lib', import.meta.url))
if (basename(output) !== 'lib') throw new Error(`refusing to clean unexpected output path: ${output}`)
rmSync(output, { recursive: true, force: true })
