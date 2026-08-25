const root = document.documentElement
const toggle = document.querySelector('.theme-toggle')
const stored = localStorage.getItem('dsh-task-planner-site-theme')
if (stored === 'light' || stored === 'dark') root.dataset.theme = stored

function currentTheme() {
  if (root.dataset.theme) return root.dataset.theme
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function syncToggle() {
  toggle?.setAttribute('aria-pressed', String(currentTheme() === 'dark'))
}

toggle?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  root.dataset.theme = next
  localStorage.setItem('dsh-task-planner-site-theme', next)
  syncToggle()
})
syncToggle()

document.querySelector('[data-copy]')?.addEventListener('click', async event => {
  const button = event.currentTarget
  const command = document.querySelector('.install-pill code')?.textContent ?? ''
  try {
    await navigator.clipboard.writeText(command)
    const original = button.textContent
    button.textContent = '已复制'
    setTimeout(() => { button.textContent = original }, 1400)
  } catch {
    window.prompt('复制安装命令', command)
  }
})
