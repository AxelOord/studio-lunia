import Image from 'next/image'
import type { Page, Media } from '@/payload-types'

function media(value: number | Media | null | undefined): Media | null {
  return value && typeof value === 'object' && value.visibility === 'public' && value.url
    ? value
    : null
}
export function ContentBlocks({ blocks }: { blocks: Page['layout'] }) {
  return blocks.map((block, index) => {
    if (block.blockType === 'hero') {
      const image = media(block.image)
      const Heading = index === 0 ? 'h1' : 'h2'
      return (
        <section className="hero" key={block.id ?? index}>
          <div className="hero-copy">
            <p className="eyebrow">{block.eyebrow}</p>
            <Heading>{block.heading}</Heading>
            <p className="intro">{block.body}</p>
            <a className="text-link" href="#discover">
              Explore the studio <span aria-hidden="true">&gt;</span>
            </a>
          </div>
          {image ? (
            <Image
              className="hero-image"
              src={image.sizes?.hero?.url || image.url!}
              alt={image.alt}
              width={image.width ?? 1600}
              height={image.height ?? 1200}
              sizes="(max-width: 760px) 100vw, 50vw"
              priority={index === 0}
            />
          ) : (
            <div className="artwork" role="img" aria-label="Abstract study of light and shadow">
              <div className="sun" />
              <div className="arch" />
              <span>LIGHT STUDY / 01</span>
            </div>
          )}
        </section>
      )
    }
    if (block.blockType === 'text')
      return (
        <section
          className="text-section"
          id={index === 1 ? 'discover' : undefined}
          key={block.id ?? index}
        >
          <p className="eyebrow">A NEW CHAPTER</p>
          <h2>{block.heading}</h2>
          <p>{block.body}</p>
        </section>
      )
    return (
      <section className="gallery-section" key={block.id ?? index}>
        <h2>{block.heading}</h2>
        <div className="gallery">
          {block.images?.map((item, i) => {
            const image = media(item.image)
            return image ? (
              <Image
                key={item.id ?? i}
                src={image.sizes?.card?.url || image.url!}
                alt={image.alt}
                width={image.width ?? 720}
                height={image.height ?? 720}
                sizes="(max-width: 760px) 100vw, 33vw"
              />
            ) : null
          })}
        </div>
      </section>
    )
  })
}
