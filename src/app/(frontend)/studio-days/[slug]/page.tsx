import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { StudioDayPage } from '@/components/StudioDayPage.server'
import { studioAvailability } from '@/studio-days/queries'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.LUNIA_SHOWCASE === 'true') notFound()
  const payload = await getPayload({ config })
  const { slug } = await params
  const day = (
    await payload.find({
      collection: 'studio-days',
      overrideAccess: false,
      draft: false,
      depth: 2,
      limit: 1,
      where: { slug: { equals: slug } },
    })
  ).docs[0]
  if (!day) notFound()
  return <StudioDayPage day={day} availability={await studioAvailability(payload, day.id)} />
}
