import { ContentBlocks } from '@/components/ContentBlocks'
import { getPage } from '@/lib/pages'
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { page } = await getPage((await params).slug)
  return { title: page.title, description: page.description }
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { page, editorPreview } = await getPage((await params).slug)
  return (
    <ContentBlocks
      blocks={page.layout}
      pageId={'id' in page ? Number(page.id) : undefined}
      editorPreview={editorPreview}
      inquiryService={page.inquiryService}
      inquiryOffer={page.inquiryOffer}
      inquiryButtonLabel={'inquiryButtonLabel' in page ? page.inquiryButtonLabel : undefined}
    />
  )
}
