import { ContentBlocks } from '@/components/ContentBlocks'
import { getPage } from '@/lib/pages'
export const dynamic = 'force-dynamic'
export default async function Home() {
  const page = await getPage('home')
  return <ContentBlocks blocks={page.layout} />
}
