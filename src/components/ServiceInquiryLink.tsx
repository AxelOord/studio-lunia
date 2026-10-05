'use client'
import { useEffect, useRef } from 'react'
import { usePrivacy } from './PrivacyControls'

export function ServiceInquiryLink({ service }: { service: string }) {
  const link = useRef<HTMLAnchorElement>(null)
  const { track } = usePrivacy()
  useEffect(() => {
    if (!link.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) track('service_viewed', service)
      },
      { threshold: 0.5 },
    )
    observer.observe(link.current)
    return () => observer.disconnect()
  }, [service, track])
  return (
    <a
      ref={link}
      className="service-link"
      href={`/inquire?service=${encodeURIComponent(service)}`}
      onClick={() => track('service_viewed', service)}
    >
      Enquire about this service <span aria-hidden="true">↗</span>
    </a>
  )
}
