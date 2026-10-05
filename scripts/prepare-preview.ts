import type { Payload } from 'payload'
import type { Page } from '../src/payload-types'
import { deploymentMode } from '../src/hosting/environment'
import { seedLandingDemo } from './seed-landing-demo'

// Build-only secret access. Do not import this module into HTTP routes or client code.
export function previewEditorPassword(env: Record<string, string | undefined>) {
  if (deploymentMode(env) !== 'preview')
    throw new Error('The shared editor password is only available to approved previews.')
  const password = env.PREVIEW_EDITOR_PASSWORD
  if (!password || password.length < 16 || /[\r\n\0]/.test(password))
    throw new Error(
      'New previews require PREVIEW_EDITOR_PASSWORD (16+ characters, no line breaks).',
    )
  return password
}

// The supplier is deliberately lazy: an existing account never reads the default
// secret, changes its password or needs a replacement secret to rebuild.
export async function initializePreview(
  payload: Payload,
  email: string,
  newEditorPassword: () => string,
) {
  const editors = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
  if (!editors.totalDocs) {
    await payload.create({
      collection: 'users',
      context: { bootstrap: true },
      overrideAccess: true,
      data: { email, password: newEditorPassword() },
    })
    console.log(
      'Preview editor initialized. Sign in using the privately supplied preview credential.',
    )
  } else if (!editors.docs.some((editor) => editor.email.toLowerCase() === email.toLowerCase())) {
    const approved = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (!approved.totalDocs)
      throw new Error('Existing preview editor does not match approved mailbox.')
  }
  for (const slug of ['home', 'blocks'] as const) {
    const existing = await payload.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
      limit: 1,
      draft: true,
      overrideAccess: true,
    })
    if (existing.totalDocs) continue
    const images: number[] = []
    for (const name of ['sand', 'sage']) {
      const alt = `Synthetic ${name} colour study — placeholder, not portfolio photography`
      const existingMedia = await payload.find({
        collection: 'media',
        where: { alt: { equals: alt } },
        limit: 1,
        overrideAccess: true,
      })
      const media =
        existingMedia.docs[0] ??
        (await payload.create({
          collection: 'media',
          overrideAccess: true,
          data: { alt, visibility: 'public' },
          filePath: `public/samples/${name}.webp`,
        }))
      images.push(media.id)
    }
    const layout: Page['layout'] = [
      {
        blockType: 'hero',
        eyebrow: 'STUDIO LUNIA · SYNTHETIC PREVIEW',
        heading:
          slug === 'home' ? 'A little space.\nA different perspective.' : 'Reusable page blocks.',
        body: 'Synthetic images and copy for review. Edit this page in the CMS.',
        image: images[0],
      },
      {
        blockType: 'imageText',
        heading: 'An editable story section.',
        body: 'Change the text, photograph and image position in the editor.',
        image: images[1],
        imageSide: 'right',
      },
      {
        blockType: 'gallery',
        heading: 'An image pair.',
        images: images.map((image) => ({ image })),
      },
      {
        blockType: 'services',
        heading: 'Space for session details.',
        body: 'Synthetic examples — no confirmed services or prices.',
        items: [{ title: 'Placeholder option', body: 'An approved description will go here.' }],
      },
      {
        blockType: 'text',
        heading: 'Content comes later.',
        body: 'These colour studies are synthetic placeholders, not portfolio work. Real photography and brand copy await approval.',
      },
      {
        blockType: 'callToAction',
        heading: 'Explore the page structure.',
        body: 'Content is editable in the CMS. Booking and tracking have not been implemented.',
        label: slug === 'home' ? 'View the block sample' : 'Back to home',
        href: slug === 'home' ? '/blocks' : '/',
      },
    ]
    await payload.create({
      collection: 'pages',
      overrideAccess: true,
      data: {
        title: 'Studio Lunia synthetic preview',
        slug,
        description: 'Editable photography website preview using synthetic images and text.',
        layout,
        _status: 'published',
      },
    })
  }
  await seedLandingDemo(payload)
}
