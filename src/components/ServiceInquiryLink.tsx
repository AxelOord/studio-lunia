'use client'
import { useEffect, useRef } from 'react'
import { originalLabel } from '../experiments/domain'
import { ExperimentLink } from './ExperimentLink'
import { usePrivacy } from './PrivacyControls'

export function ServiceInquiryLink({
  service,
  primary = false,
  page,
  label = originalLabel,
  editorPreview = false,
}: {
  service: string
  primary?: boolean
  page?: number
  label?: string
  editorPreview?: boolean
}) {
  const link = useRef<HTMLAnchorElement>(null)
  const { track, experimentsAllowed } = usePrivacy()
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
  if (primary && page && !editorPreview)
    return (
      <ExperimentLink
        key={`${page}:${experimentsAllowed}`}
        page={page}
        service={service}
        original={label}
      />
    )
  return (
    <a
      ref={link}
      className={primary ? 'button-link' : 'service-link'}
      href={`/inquire?service=${encodeURIComponent(service)}`}
      onClick={() => {
        if (!editorPreview) track('service_viewed', service)
      }}
    >
      {label} <span aria-hidden="true">{primary ? '→' : '↗'}</span>
    </a>
  )
}
