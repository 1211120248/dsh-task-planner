import { cp, mkdir, rm } from 'node:fs/promises'

await rm('site-dist', { recursive: true, force: true })
await mkdir('site-dist/assets', { recursive: true })
await cp('site/index.html', 'site-dist/index.html')
await cp('site/styles.css', 'site-dist/styles.css')
await cp('site/app.js', 'site-dist/app.js')
for (const name of ['gui-light.png', 'gui-dark.png', 'gui-community.png']) await cp(`docs/assets/${name}`, `site-dist/assets/${name}`)
console.log('built site-dist')
