import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { LivePagePreview } from '@/components/LivePagePreview'

export const dynamic = 'force-dynamic'

export default async function LivePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) notFound()
  const page = await payload.findByID({
    collection: 'pages',
    id,
    user,
    overrideAccess: false,
    draft: true,
    depth: 2,
    disableErrors: true,
  })
  if (!page) notFound()
  return <LivePagePreview key={page.id} page={page} />
}
