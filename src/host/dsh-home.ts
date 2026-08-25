import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

export function resolveDshHome(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const raw = env.DSH_HOME?.trim()
  if (raw === undefined || raw === '') return join(home, '.dsh')
  const expanded = raw === '~' ? home : raw.startsWith('~/') || raw.startsWith('~\\') ? join(home, raw.slice(2)) : raw
  return isAbsolute(expanded) ? expanded : join(process.cwd(), expanded)
}
