/** Canonical local Workshop Router host used when the page itself is loopback. */
export const DEFAULT_LOCAL_ROUTER_HOST = '127.0.0.1:8787'

export type BackendEndpointInput = Readonly<{
  /** Vite `import.meta.env.DEV` — only the Vite client is hosted apart from the backend. */
  isDev: boolean
  /** `window.location.protocol`, including the trailing colon. */
  pageProtocol: string
  /** `window.location.hostname` (no port). */
  pageHostname: string
  /** `window.location.host` (`hostname` plus port when non-default). */
  pageHost: string
  /** Optional `VITE_BACKEND_HOST` (`host` or `host:port`). */
  viteBackendHost?: string | null
}>

/** True for loopback names the browser uses for local Personal access. */
export function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '[::1]' ||
    normalized === '::1'
  )
}

/** Hostname portion of a `host` or `host:port` string (IPv6 bracket form accepted). */
export function hostnameOfHostPort(hostPort: string): string {
  try {
    return new URL(`http://${hostPort.trim()}`).hostname
  } catch {
    return hostPort.trim()
  }
}

/**
 * Resolves the host[:port] the Workshop browser should open for `/api`.
 *
 * Production / run-local built assets share origin with the Worker, so the page host wins.
 * In Vite DEV:
 * - a loopback page always targets the local Router (`127.0.0.1:8787`, or a loopback
 *   `VITE_BACKEND_HOST` when one is set for a custom local port) — never a remote Tailnet host
 * - a remote / Tailnet page uses `VITE_BACKEND_HOST` when set (TLS Router), else the page host
 */
export function resolveBackendHost(input: BackendEndpointInput): string {
  if (!input.isDev) return input.pageHost

  const configured = input.viteBackendHost?.trim() ?? ''

  if (isLoopbackHostname(input.pageHostname)) {
    if (configured && isLoopbackHostname(hostnameOfHostPort(configured))) {
      return configured
    }
    return DEFAULT_LOCAL_ROUTER_HOST
  }

  return configured || input.pageHost
}

/** Full WebSocket URL for the Workshop RPC session (`…/api`). */
export function resolveWebSocketApiUrl(input: BackendEndpointInput): string {
  const wsProtocol = input.pageProtocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProtocol}//${resolveBackendHost(input)}/api`
}
