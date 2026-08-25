import type { IncomingMessage } from 'node:http'

function ipv4Loopback(value: string): boolean {
  const parts = value.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function loopbackAddress(value: string | undefined): boolean {
  if (value === undefined) return false
  const normalized = value.toLowerCase()
  return normalized === '::1' || ipv4Loopback(normalized) || normalized.startsWith('::ffff:') && ipv4Loopback(normalized.slice(7))
}

export function trustedBrowserRequest(request: IncomingMessage): boolean {
  if (!loopbackAddress(request.socket.remoteAddress)) return false
  const host = request.headers.host
  if (typeof host !== 'string' || request.headers['sec-fetch-site'] === 'cross-site') return false
  let hostUrl: URL
  try { hostUrl = new URL(`http://${host}`) } catch { return false }
  if (!(hostUrl.hostname === 'localhost' || hostUrl.hostname === '[::1]' || ipv4Loopback(hostUrl.hostname))) return false
  const origin = request.headers.origin
  if (origin === undefined) return request.headers['sec-fetch-site'] === 'same-origin' || request.headers['sec-fetch-site'] === undefined
  try { return new URL(origin).host === hostUrl.host } catch { return false }
}
