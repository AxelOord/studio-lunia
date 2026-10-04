import type { Page } from '@/payload-types'

export const samplePage: Pick<Page, 'title' | 'description' | 'layout' | 'slug'> = {
  title: 'Studio Lunia',
  slug: 'home',
  description: 'A considered space for photography. Studio Lunia website preview.',
  layout: [
    {
      blockType: 'hero',
      eyebrow: 'STUDIO LUNIA · PHOTOGRAPHY',
      heading: 'A little space.\nA different perspective.',
      body: 'A first look at a new home for photography.',
    },
    {
      blockType: 'text',
      heading: 'Room for the work.',
      body: 'Photographs, stories and the details that make a session yours. The portfolio and session information will appear here when they are ready.',
    },
  ],
}
