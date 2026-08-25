import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: { sourcemapIgnoreList: () => true },
  test: {
    include: ['tests/**/*.{spec,test}.{ts,tsx}'],
    environment: 'node',
    pool: 'forks',
    server: { deps: { inline: [/@deepseek-ai\//] } },
  },
})
