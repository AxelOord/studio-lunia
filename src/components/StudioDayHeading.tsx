'use client'
import { useEffect, useRef } from 'react'
import { usePrivacy } from './PrivacyControls'

export function StudioDayHeading({ day, title }: { day: number; title: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { trackStudio, measurementReady } = usePrivacy()
  useEffect(() => {
    if (!measurementReady || !heading.current) return
    // Observe only current exposure after consent is ready; never replay an earlier action.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5))
          trackStudio('studio_day_viewed', day)
      },
      { threshold: 0.5 },
    )
    observer.observe(heading.current)
    return () => observer.disconnect()
  }, [day, measurementReady, trackStudio])
  return <h1 ref={heading}>{title}</h1>
}
