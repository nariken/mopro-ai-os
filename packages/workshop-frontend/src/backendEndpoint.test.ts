import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCAL_ROUTER_HOST,
  hostnameOfHostPort,
  isLoopbackHostname,
  resolveBackendHost,
  resolveWebSocketApiUrl,
} from './backendEndpoint'

describe('isLoopbackHostname', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]'])(
    'accepts %s',
    hostname => {
      expect(isLoopbackHostname(hostname)).toBe(true)
    },
  )

  it.each(['kenmacbook-air.tail2d8dc6.ts.net', 'example.com', '0.0.0.0'])(
    'rejects %s',
    hostname => {
      expect(isLoopbackHostname(hostname)).toBe(false)
    },
  )
})

describe('hostnameOfHostPort', () => {
  it('strips a TCP port', () => {
    expect(hostnameOfHostPort('kenmacbook-air.tail2d8dc6.ts.net:8443')).toBe(
      'kenmacbook-air.tail2d8dc6.ts.net',
    )
  })

  it('keeps a bare hostname', () => {
    expect(hostnameOfHostPort('127.0.0.1')).toBe('127.0.0.1')
  })
})

describe('resolveBackendHost', () => {
  it('uses the page host outside Vite DEV', () => {
    expect(
      resolveBackendHost({
        isDev: false,
        pageProtocol: 'https:',
        pageHostname: 'app.example.com',
        pageHost: 'app.example.com',
        viteBackendHost: 'ignored.example:8787',
      }),
    ).toBe('app.example.com')
  })

  it('keeps a loopback page on the local Router even when VITE_BACKEND_HOST is a Tailnet TLS host', () => {
    expect(
      resolveBackendHost({
        isDev: true,
        pageProtocol: 'http:',
        pageHostname: 'localhost',
        pageHost: 'localhost:3000',
        viteBackendHost: 'kenmacbook-air.tail2d8dc6.ts.net:8443',
      }),
    ).toBe(DEFAULT_LOCAL_ROUTER_HOST)
  })

  it('honors a loopback VITE_BACKEND_HOST when the page is also loopback', () => {
    expect(
      resolveBackendHost({
        isDev: true,
        pageProtocol: 'http:',
        pageHostname: '127.0.0.1',
        pageHost: '127.0.0.1:3000',
        viteBackendHost: 'localhost:9000',
      }),
    ).toBe('localhost:9000')
  })

  it('defaults a loopback page to 127.0.0.1:8787 when VITE_BACKEND_HOST is unset', () => {
    expect(
      resolveBackendHost({
        isDev: true,
        pageProtocol: 'http:',
        pageHostname: 'localhost',
        pageHost: 'localhost:3000',
      }),
    ).toBe(DEFAULT_LOCAL_ROUTER_HOST)
  })

  it('uses VITE_BACKEND_HOST for a Tailnet / remote Vite page', () => {
    expect(
      resolveBackendHost({
        isDev: true,
        pageProtocol: 'https:',
        pageHostname: 'kenmacbook-air.tail2d8dc6.ts.net',
        pageHost: 'kenmacbook-air.tail2d8dc6.ts.net:3000',
        viteBackendHost: 'kenmacbook-air.tail2d8dc6.ts.net:8443',
      }),
    ).toBe('kenmacbook-air.tail2d8dc6.ts.net:8443')
  })

  it('falls back to the page host for a remote Vite page without VITE_BACKEND_HOST', () => {
    expect(
      resolveBackendHost({
        isDev: true,
        pageProtocol: 'https:',
        pageHostname: 'kenmacbook-air.tail2d8dc6.ts.net',
        pageHost: 'kenmacbook-air.tail2d8dc6.ts.net:3000',
      }),
    ).toBe('kenmacbook-air.tail2d8dc6.ts.net:3000')
  })
})

describe('resolveWebSocketApiUrl', () => {
  it('builds ws:// to the local Router from http://localhost:3000 despite a Tailnet VITE_BACKEND_HOST', () => {
    expect(
      resolveWebSocketApiUrl({
        isDev: true,
        pageProtocol: 'http:',
        pageHostname: 'localhost',
        pageHost: 'localhost:3000',
        viteBackendHost: 'kenmacbook-air.tail2d8dc6.ts.net:8443',
      }),
    ).toBe('ws://127.0.0.1:8787/api')
  })

  it('builds wss:// through the TLS Router host for Tailnet HTTPS', () => {
    expect(
      resolveWebSocketApiUrl({
        isDev: true,
        pageProtocol: 'https:',
        pageHostname: 'kenmacbook-air.tail2d8dc6.ts.net',
        pageHost: 'kenmacbook-air.tail2d8dc6.ts.net:3000',
        viteBackendHost: 'kenmacbook-air.tail2d8dc6.ts.net:8443',
      }),
    ).toBe('wss://kenmacbook-air.tail2d8dc6.ts.net:8443/api')
  })

  it('builds same-origin wss:// outside Vite DEV', () => {
    expect(
      resolveWebSocketApiUrl({
        isDev: false,
        pageProtocol: 'https:',
        pageHostname: 'workshop.example',
        pageHost: 'workshop.example',
      }),
    ).toBe('wss://workshop.example/api')
  })
})
