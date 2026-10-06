'use client'
import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { campaignKeys } from '@/lib/campaign'
import type { StudioVisitorEvent } from '@/studio-days/measurement'

type VisitorMeasurement =
  | { event: 'service_viewed' | 'inquiry_started'; service: string }
  | { event: StudioVisitorEvent; day: number }

type Choice = {
  experiments: boolean
  analytics: boolean
  campaigns: boolean
  decided: boolean
  configured: boolean
}
const initial: Choice = {
  experiments: false,
  analytics: false,
  campaigns: false,
  decided: false,
  configured: false,
}
const PrivacyContext = createContext<{
  experimentsAllowed: boolean
  track: (event: 'service_viewed' | 'inquiry_started', service: string) => void
  trackStudio: (event: StudioVisitorEvent, day: number) => void
  measurementReady: boolean
  syncCampaign: () => Promise<void>
  settleMeasurement: () => Promise<void>
  submissionPermissions: () => {
    campaignsAllowed: boolean
    analyticsAllowed: boolean
    experimentsAllowed: boolean
  }
}>({
  experimentsAllowed: false,
  track: () => {},
  trackStudio: () => {},
  measurementReady: false,
  syncCampaign: async () => {},
  settleMeasurement: async () => {},
  submissionPermissions: () => ({
    campaignsAllowed: false,
    analyticsAllowed: false,
    experimentsAllowed: false,
  }),
})
export function usePrivacy() {
  return useContext(PrivacyContext)
}

export function PrivacyControls({
  children,
  disabled = false,
}: {
  children: React.ReactNode
  disabled?: boolean
}) {
  const path = usePathname()
  const [choice, setChoice] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const current = useRef(initial)
  const pending = useRef(new Set<AbortController>())
  const sent = useRef(new Set<string>())
  const generation = useRef(0)
  const measurementTask = useRef<Promise<void>>(Promise.resolve())
  const campaignTask = useRef<Promise<void>>(Promise.resolve())
  const privacyChannel = useRef<BroadcastChannel | null>(null)
  const disabledHere = disabled || path.startsWith('/preview')
  const syncCampaign = useCallback(async () => {
    if (!current.current.campaigns || disabledHere) return
    const tags: Record<string, string> = {}
    const params = new URLSearchParams(window.location.search)
    for (const key of campaignKeys) {
      const value = params.get(key)
      if (value !== null) tags[key] = value.length <= 120 ? value : ''
    }
    let arrival = 'unknown'
    try {
      arrival = !document.referrer
        ? 'direct'
        : new URL(document.referrer).origin === location.origin
          ? 'unknown'
          : 'untagged'
    } catch {
      /* unknown */
    }
    const controller = new AbortController()
    pending.current.add(controller)
    campaignTask.current = fetch('/api/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, arrival }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]),
    })
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        pending.current.delete(controller)
      })
    await campaignTask.current
  }, [disabledHere])
  useEffect(() => {
    if (disabledHere) return
    const controller = new AbortController()
    const readGeneration = generation.current
    fetch('/api/privacy', { cache: 'no-store', signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((value: Choice) => {
        if (controller.signal.aborted || generation.current !== readGeneration) return
        current.current = value
        setChoice(value)
        setDraft(value)
        setOpen(!value.decided)
        void syncCampaign()
      })
      .catch(() => {})
    return () => controller.abort()
  }, [disabledHere, syncCampaign])
  useEffect(() => {
    void syncCampaign()
  }, [path, syncCampaign])
  useEffect(() => {
    const channel = new BroadcastChannel('lunia-privacy')
    privacyChannel.current = channel
    channel.onmessage = () => {
      // Pause immediately in other tabs. A refresh reads the saved server choice.
      current.current = initial
      setChoice(initial)
      generation.current++
      for (const controller of pending.current) controller.abort()
      pending.current.clear()
    }
    return () => {
      privacyChannel.current = null
      channel.close()
    }
  }, [])
  const queueMeasurement = useCallback(
    (measurement: VisitorMeasurement) => {
      if (!current.current.analytics || !current.current.configured || disabledHere) return
      const key = `${measurement.event}:${'day' in measurement ? measurement.day : measurement.service}`
      if (sent.current.has(key)) return
      sent.current.add(key)
      const controller = new AbortController()
      pending.current.add(controller)
      const consentGeneration = generation.current
      measurementTask.current = measurementTask.current.then(async () => {
        try {
          if (
            controller.signal.aborted ||
            !current.current.analytics ||
            generation.current !== consentGeneration
          )
            return
          await fetch('/api/measurement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(measurement),
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]),
          })
        } catch {
          /* Missing events never block an enquiry or booking. */
        } finally {
          pending.current.delete(controller)
        }
      })
    },
    [disabledHere],
  )
  const track = useCallback(
    (event: 'service_viewed' | 'inquiry_started', service: string) =>
      queueMeasurement({ event, service }),
    [queueMeasurement],
  )
  const trackStudio = useCallback(
    (event: StudioVisitorEvent, day: number) => queueMeasurement({ event, day }),
    [queueMeasurement],
  )
  const save = async (value: Choice) => {
    setBusy(true)
    setError('')
    privacyChannel.current?.postMessage('pause')
    // Stop collection immediately, even if saving the withdrawal subsequently fails.
    current.current = initial
    setChoice(initial)
    generation.current++
    for (const controller of pending.current) controller.abort()
    pending.current.clear()
    try {
      const result = await fetch('/api/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analytics: value.analytics,
          campaigns: value.campaigns,
          experiments: value.experiments,
        }),
      })
      if (!result.ok) throw new Error()
      const saved: Choice = await result.json()
      current.current = saved
      setChoice(saved)
      setDraft(saved)
      setOpen(false)
      sent.current.clear()
      await syncCampaign()
    } catch {
      setError(
        'We could not save your choice. Collection is paused on this page. Please try again before leaving.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <PrivacyContext.Provider
      value={{
        experimentsAllowed: Boolean(choice.experiments) && !disabledHere,
        track,
        trackStudio,
        measurementReady: choice.analytics && choice.configured && !busy && !error && !disabledHere,
        syncCampaign,
        settleMeasurement: () => measurementTask.current,
        submissionPermissions: () => ({
          campaignsAllowed: current.current.campaigns && !disabledHere,
          analyticsAllowed: current.current.analytics && !disabledHere,
          experimentsAllowed: current.current.experiments && !disabledHere,
        }),
      }}
    >
      {children}
      {!disabledHere && (
        <section className="privacy-controls" aria-label="Privacy choices">
          <button
            type="button"
            className="text-button"
            aria-expanded={open}
            onClick={() => {
              setDraft(choice)
              setOpen(!open)
            }}
          >
            Privacy choices
          </button>
          {open && (
            <div className="privacy-panel">
              <h2>Your privacy choices</h2>
              <p>
                Enquiries and studio bookings work without optional tracking. Choose what to allow;
                all are off by default.
              </p>
              <label className="check-choice">
                <input
                  type="checkbox"
                  checked={draft.analytics}
                  onChange={(e) => setDraft({ ...draft, analytics: e.target.checked })}
                />{' '}
                Measure service views, enquiry steps and studio booking steps with PostHog EU. No
                form details or session recordings.
              </label>
              {!choice.configured && (
                <p className="field-help">
                  PostHog is not connected in this preview. No PostHog events are sent.
                </p>
              )}
              <label className="check-choice">
                <input
                  type="checkbox"
                  checked={draft.campaigns}
                  onChange={(e) => setDraft({ ...draft, campaigns: e.target.checked })}
                />{' '}
                Remember campaign tags and advertising click IDs for 30 days and attach them to my
                enquiry or studio booking.
              </label>
              <label className="check-choice">
                <input
                  type="checkbox"
                  checked={Boolean(draft.experiments)}
                  onChange={(e) => setDraft({ ...draft, experiments: e.target.checked })}
                />{' '}
                Take part in page improvement tests. Remember my variant for up to 30 days and
                measure whether I send an enquiry. No form details are included.
              </label>
              <p className="field-help">
                Live tests are disabled in this preview. Signed-in staff can try a labelled
                simulation.
              </p>
              <p className="field-help">
                We remember your choice for 180 days. Withdrawal removes optional browser cookies
                and stops future collection. It does not erase previously submitted enquiries or
                studio bookings, or already delivered events.{' '}
                <Link href="/privacy">Read the preview privacy notice</Link>.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="button-link"
                  disabled={busy}
                  onClick={() => void save({ ...initial, decided: true })}
                >
                  Decline optional
                </button>
                <button
                  type="button"
                  className="button-link"
                  disabled={busy}
                  onClick={() => void save(draft)}
                >
                  Save choices
                </button>
              </div>
              {choice.decided && (choice.analytics || choice.campaigns || choice.experiments) && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => void save({ ...initial, decided: true })}
                >
                  Withdraw optional consent
                </button>
              )}
              {error && <p role="alert">{error}</p>}
            </div>
          )}
        </section>
      )}
    </PrivacyContext.Provider>
  )
}
