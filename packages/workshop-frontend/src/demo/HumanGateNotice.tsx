import { Banner } from '@cloudflare/kumo'

/** Visible Human Gate notice — full contract string must appear in the DOM. */
export function HumanGateNotice({ children }: { children: string }) {
  return <Banner variant="alert" title={children} />
}
