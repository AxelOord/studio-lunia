'use client'
import { useEffect, useRef } from 'react'
import { usePrivacy } from './PrivacyControls'

export function ServiceInquiryLink({
  service,
  primary = false,
  editorPreview = false,
}: {
  service: string
  primary?: boolean
  editorPreview?: boolean
}) {
  const link = useRef<HTMLAnchorElement>(null)
  const { track } = usePrivacy()
  useEffect(() => {
    if (!link.current || editorPreview) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) track('service_viewed', service)
      },
      { threshold: 0.5 },
    )
    observer.observe(link.current)
    return () => observer.disconnect()
  }, [service, track, editorPreview])
  return (
    <a
      ref={link}
      className={primary ? 'button-link' : 'service-link'}
      href={`/inquire?service=${encodeURIComponent(service)}`}
      onClick={() => {
        if (!editorPreview) track('service_viewed', service)
      }}
    >
      Enquire about this service <span aria-hidden="true">{primary ? '→' : '↗'}</span>
    </a>
  )
}
