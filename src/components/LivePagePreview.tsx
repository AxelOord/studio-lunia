'use client'

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react'
import { useLivePreview } from '@payloadcms/live-preview-react'
import type { LandingPreviewPage as Page } from '@/inquiries/services'
import { ContentBlocks } from './ContentBlocks'

const subscribeToOrigin = () => () => {}
const browserOrigin = () => window.location.origin
const serverOrigin = () => ''

export function LivePagePreview({ page }: { page: Page }) {
  const origin = useSyncExternalStore(subscribeToOrigin, browserOrigin, serverOrigin)
  return origin ? (
    <ConnectedPreview page={page} origin={origin} />
  ) : (
    <ContentBlocks
      blocks={page.layout}
      inquiryService={page.inquiryService}
      inquiryOffer={page.inquiryOffer}
      editorPreview
    />
  )
}

function ConnectedPreview({ page, origin }: { page: Page; origin: string }) {
  const [failed, setFailed] = useState(false)
  const latest = useRef<Promise<Page> | null>(null)
  const lastGood = useRef(page)

  // The native hook validates origin. Additionally bind messages to the actual
  // editor window and persisted document before its bubble-phase listener runs.
  useEffect(() => {
    const guard = (event: MessageEvent) => {
      if (event.data?.type !== 'payload-live-preview') return
      if (
        event.origin !== origin ||
        (event.source !== window.parent && event.source !== window.opener) ||
        event.data.collectionSlug !== 'pages' ||
        String(event.data.data?.id) !== String(page.id)
      )
        event.stopImmediatePropagation()
    }
    window.addEventListener('message', guard, true)
    return () => window.removeEventListener('message', guard, true)
  }, [origin, page.id])

  const requestHandler = useCallback(
    async ({ data }: { data: Record<string, unknown> }) => {
      const pending = (async () => {
        try {
          const response = await fetch(`/preview/live/${page.id}/populate`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!response.ok) throw new Error('Preview unavailable')
          return (await response.json()) as Page
        } catch {
          return null
        }
      })()
      const current: Promise<Page> = pending.then((value) => {
        if (latest.current === current) {
          setFailed(!value)
          if (value) lastGood.current = value
        }
        return value ?? lastGood.current
      })
      latest.current = current
      let newest = current
      let value = await newest
      // A slow earlier population must never replace a newer edit.
      while (latest.current && newest !== latest.current) {
        newest = latest.current
        value = await newest
      }
      return Response.json(value)
    },
    [page.id],
  )

  const { data } = useLivePreview<Page>({
    initialData: page,
    serverURL: origin,
    depth: 2,
    requestHandler,
  })
  if (failed)
    return (
      <p role="alert">
        Live preview is unavailable. Sign in again or reload the editor. Your unsaved changes remain
        in the editor.
      </p>
    )
  return (
    <ContentBlocks
      blocks={data.layout}
      inquiryService={data.inquiryService}
      inquiryOffer={data.inquiryOffer}
      editorPreview
    />
  )
}
