import { useEffect, useState, type ReactNode } from 'react'
import { useServerConfig } from '../ServerConfigContext'
import defaultSiteLogoUrl from '../../../../assets/brand/mopro-ai-os-symbol.svg'

export default function SiteLogo({
  size,
  className,
  srcOverride,
  children,
}: {
  size: number
  className?: string
  srcOverride?: string | null
  children: ReactNode
}) {
  const serverConfig = useServerConfig()
  const configuredUrl = serverConfig?.siteLogo?.url
  const src = srcOverride === undefined ? configuredUrl : srcOverride ?? undefined
  const [failed, setFailed] = useState(false)
  const [defaultFailed, setDefaultFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    setDefaultFailed(false)
  }, [src, serverConfig])

  const displayedSrc = !src || failed ? defaultSiteLogoUrl : src
  if (defaultFailed) return children
  return (
    <img
      src={displayedSrc}
      alt=""
      width={size}
      height={size}
      className={`object-contain ${className ?? ''}`}
      onError={() => {
        if (displayedSrc === defaultSiteLogoUrl) setDefaultFailed(true)
        else setFailed(true)
      }}
    />
  )
}
