import type { Media, Page } from '@/payload-types'

// Static synthetic fixtures only. Never written to Payload or backed by CMS IDs.
const study = (name: string, id: number): Media => ({
  id,
  alt: `Synthetic ${name} colour study — placeholder, not portfolio photography`,
  visibility: 'public',
  url: `/samples/${name}.webp`,
  width: 960,
  height: 1200,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
})
const sand = study('sand', -1)
const sage = study('sage', -2)
export function blockPreviewPage(
  slug: 'home' | 'blocks',
): Pick<Page, 'title' | 'description' | 'layout' | 'slug'> {
  return {
    title: 'Synthetic block preview',
    slug,
    description:
      'Read-only layout preview using synthetic images and text. CMS and booking unavailable.',
    layout: [
      {
        blockType: 'hero',
        eyebrow: 'SYNTHETIC BLOCK PREVIEW',
        heading:
          slug === 'home' ? 'A little space.\nA different perspective.' : 'Reusable page blocks.',
        body: 'Placeholder images and copy for layout review. Real photography and brand assets will follow.',
        image: sand,
      },
      {
        blockType: 'imageText',
        heading: 'An editable story section.',
        body: 'This image and text layout can place the image on either side. This preview uses static examples; editing is available only in the separately configured CMS.',
        image: sage,
        imageSide: 'right',
      },
      {
        blockType: 'gallery',
        heading: 'An image pair.',
        images: [{ image: sand }, { image: sage }],
      },
      {
        blockType: 'services',
        heading: 'Space for session details.',
        body: 'Synthetic examples — no confirmed services or prices.',
        items: [
          { title: 'Placeholder option one', body: 'An approved description will go here.' },
          {
            title: 'Placeholder option two',
            body: 'Details and photographs are still to be supplied.',
          },
          { title: 'Placeholder option three', body: 'No booking or availability is represented.' },
        ],
      },
      {
        blockType: 'text',
        heading: 'Content comes later.',
        body: 'These colour studies are synthetic placeholders, not portfolio work. Logos, fonts, photographs and copy await approval.',
      },
      {
        blockType: 'callToAction',
        heading: 'Explore the page structure.',
        body: 'Navigation works between the two sample pages. The CMS, forms, booking and tracking are disabled.',
        label: slug === 'home' ? 'View the block sample' : 'Back to the sample home',
        href: slug === 'home' ? '/blocks' : '/',
      },
    ],
  }
}
