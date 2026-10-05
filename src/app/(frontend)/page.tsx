import { ContentBlocks } from '@/components/ContentBlocks'
import { getPage } from '@/lib/pages'
export const dynamic = 'force-dynamic'
export default async function Home() {
  const { page, editorPreview } = await getPage('home')
  return (
    <ContentBlocks
      blocks={page.layout}
      pageId={'id' in page ? Number(page.id) : undefined}
      editorPreview={editorPreview}
      inquiryService={page.inquiryService}
      inquiryOffer={page.inquiryOffer}
    />
  )
}
