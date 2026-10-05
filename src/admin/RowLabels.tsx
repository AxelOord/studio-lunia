'use client'

import { useRowLabel } from '@payloadcms/ui'

const labels: Record<string, string> = {
  hero: 'Intro / hero',
  text: 'Text section',
  gallery: 'Photo gallery',
  imageText: 'Image and text',
  services: 'Service cards',
  callToAction: 'Call to action',
}

export function BlockRowLabel() {
  const { data, rowNumber } = useRowLabel<{ heading?: string; blockType?: string }>()
  const type = labels[data?.blockType ?? ''] ?? 'Block'
  return (
    <span>
      {(rowNumber ?? 0) + 1}. {type}
      {data?.heading?.trim() ? ` — ${data.heading}` : ''}
    </span>
  )
}

export function ServiceRowLabel() {
  const { data, rowNumber } = useRowLabel<{ title?: string }>()
  return <span>{data?.title?.trim() || `Service card ${(rowNumber ?? 0) + 1}`}</span>
}
