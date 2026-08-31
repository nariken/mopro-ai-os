import { useEffect, useRef, type ReactNode } from 'react'
import { SyntheticBadge } from './SyntheticBadge'

export function DemoFrame({
  badge = 'default',
  title,
  supporting,
  wide = false,
  children,
}: {
  badge?: 'default' | 'internal' | 'privacy' | 'noSend'
  title: string
  supporting?: string
  wide?: boolean
  children: ReactNode
}) {
  const h1Ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    h1Ref.current?.focus()
  }, [title])

  return (
    <div className="min-h-full bg-kumo-base">
      <div
        className={`mx-auto px-4 py-8 sm:px-6 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}
      >
        <div className="mb-2">
          <SyntheticBadge variant={badge} />
        </div>
        <h1
          ref={h1Ref}
          tabIndex={-1}
          className="m-0 text-[28px] leading-9 font-semibold tracking-[-0.6px] text-kumo-default outline-none"
        >
          {title}
        </h1>
        {supporting && (
          <p className="mt-2 max-w-2xl text-[14px] leading-5 font-normal tracking-[-0.25px] text-kumo-subtle">
            {supporting}
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
