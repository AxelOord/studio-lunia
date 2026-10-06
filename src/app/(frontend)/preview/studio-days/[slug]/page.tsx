import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { StudioDayPage } from '@/components/StudioDayPage.server'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.LUNIA_SHOWCASE === 'true') notFound()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) notFound()
  const { slug } = await params
  const day = (
    await payload.find({
      collection: 'studio-days',
      user,
      overrideAccess: false,
      draft: true,
      depth: 2,
      limit: 1,
      where: { slug: { equals: slug } },
    })
  ).docs[0]
  if (!day) notFound()
  return <StudioDayPage day={day} preview />
}
