import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const required = ['README.md', 'README.zh.md', 'README.i18n.yaml', 'PRIVACY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE', 'docs/assets/gui-light.png', 'docs/assets/gui-dark.png', 'docs/assets/gui-community.png']
for (const file of required) if (!existsSync(file)) throw new Error(`missing required public file: ${file}`)
const record = readFileSync('README.i18n.yaml', 'utf8')
for (const file of ['README.md', 'README.zh.md']) {
  const hash = execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim()
  if (!record.includes(`${file}: ${hash}`)) throw new Error(`${file}: README.i18n.yaml hash is stale`)
}
const en = readFileSync('README.md', 'utf8')
const zh = readFileSync('README.zh.md', 'utf8')
if (!en.startsWith('# dsh-task-planner\n\nEnglish | [中文](README.zh.md)')) throw new Error('English language switcher is invalid')
if (!zh.startsWith('# dsh-task-planner\n\n[English](README.md) | 中文')) throw new Error('Chinese language switcher is invalid')
for (const file of ['README.md', 'README.zh.md']) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)) if (!existsSync(match[1])) throw new Error(`${file}: broken link ${match[1]}`)
}
console.log('documentation pair and links are valid')
