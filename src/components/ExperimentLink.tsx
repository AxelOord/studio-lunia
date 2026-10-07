'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivacy } from './PrivacyControls'
import type { Assignment } from '../experiments/domain'

export function ExperimentLink({
  page,
  service,
  original,
}: {
  page: number
  service: string
  original: string
}) {
  const router = useRouter()
  const { experimentsAllowed, track } = usePrivacy()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const link = useRef<HTMLAnchorElement>(null)
  const exposure = useRef<Promise<void> | null>(null)
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
  useEffect(() => {
    if (!experimentsAllowed) return
    const controller = new AbortController()
    fetch('/api/experiments/assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]),
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((selected: Assignment | null) => {
        if (!controller.signal.aborted) setAssignment(selected)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [experimentsAllowed, page])
  useEffect(() => {
    if (!experimentsAllowed || !assignment || !link.current) return
    // Effects run after React commits the assigned text to the DOM.
    const controller = new AbortController()
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return
        exposure.current ??= fetch('/api/experiments/exposure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page, experiment: assignment.experiment }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]),
        }).then(
          () => {},
          () => {},
        )
      },
      { threshold: 0.5 },
    )
    observer.observe(link.current)
    return () => {
      controller.abort()
      observer.disconnect()
    }
  }, [assignment, experimentsAllowed, page])
  const selected = experimentsAllowed ? assignment : null
  return (
    <>
      <a
        ref={link}
        className="button-link"
        href={`/inquire?service=${encodeURIComponent(service)}`}
        onClick={async (event) => {
          track('service_viewed', service)
          if (
            exposure.current &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            event.button === 0
          ) {
            event.preventDefault()
            await exposure.current
            router.push(`/inquire?service=${encodeURIComponent(service)}`)
          }
        }}
      >
        {selected?.label || original} <span aria-hidden="true">→</span>
      </a>
      {selected?.simulation && (
        <p className="field-help">Staff simulation · Synthetic test results only</p>
      )}
    </>
  )
}
