import Image from 'next/image'
import type { Page, Media } from '@/payload-types'
import { isInternalPagePath } from '@/lib/internal-path'
import { ServiceInquiryLink } from './ServiceInquiryLink'
import { ServiceOffer, EnquirySteps } from './ServiceOffer'
import type { ServiceChoice } from '@/lib/inquiry'

function visibleMedia(
  value: number | Media | null | undefined,
  editorPreview: boolean,
): Media | null {
  return value &&
    typeof value === 'object' &&
    (value.visibility === 'public' || editorPreview) &&
    value.url
    ? value
    : null
}

function BlockImage({
  image,
  size = 'hero',
  priority = false,
  className,
  sizes = '(max-width: 760px) 100vw, 50vw',
}: {
  image: Media
  size?: 'hero' | 'card'
  priority?: boolean
  className?: string
  sizes?: string
}) {
  const source = image.sizes?.[size]?.url ? image.sizes[size] : image
  return (
    <Image
      className={className}
      src={source!.url!}
      alt={image.alt}
      width={source!.width ?? image.width ?? 1600}
      height={source!.height ?? image.height ?? 1200}
      sizes={sizes}
      priority={priority}
      style={{ objectPosition: `${image.focalX ?? 50}% ${image.focalY ?? 50}%` }}
    />
  )
}

export function ContentBlocks({
  blocks,
  editorPreview = false,
  pageId,
  inquiryService,
  inquiryOffer,
  inquiryButtonLabel,
}: {
  blocks: Page['layout']
  editorPreview?: boolean
  pageId?: number
  inquiryService?: string | null
  inquiryOffer?: ServiceChoice | null
  inquiryButtonLabel?: string | null
}) {
  const visibleBlocks = (Array.isArray(blocks) ? blocks : []).filter(Boolean)
  const offer = inquiryService ? (
    <div className="landing-offer">
      {inquiryOffer ? (
        <>
          <ServiceOffer service={inquiryOffer} />
          <ServiceInquiryLink
            page={pageId}
            label={inquiryButtonLabel || undefined}
            service={inquiryOffer.id}
            primary
            editorPreview={editorPreview}
          />
          <p className="field-help">
            Start with a short enquiry. Your date and details are agreed personally.
          </p>
        </>
      ) : (
        <p role="status">
          This service is not currently available for enquiries. Please check back later.
        </p>
      )}
    </div>
  ) : null
  return (
    <>
      {offer && visibleBlocks[0]?.blockType !== 'hero' && (
        <section className="landing-intro">{offer}</section>
      )}
      {visibleBlocks.map((block, index) => {
        const Heading = index === 0 ? 'h1' : 'h2'
        const CardHeading = index === 0 ? 'h2' : 'h3'
        const key = block.id ?? index
        switch (block.blockType) {
          case 'hero': {
            const image = visibleMedia(block.image, editorPreview)
            return (
              <section className="hero" key={key}>
                <div className="hero-copy">
                  {block.eyebrow && <p className="eyebrow">{block.eyebrow}</p>}
                  <Heading>{block.heading}</Heading>
                  {block.body && <p className="intro">{block.body}</p>}
                  {index === 0 && offer}
                </div>
                {image ? (
                  <BlockImage className="hero-image" image={image} priority={index === 0} />
                ) : (
                  <div
                    className="artwork"
                    role="img"
                    aria-label="Abstract study of light and shadow"
                  >
                    <div className="sun" />
                    <div className="arch" />
                    <span>LIGHT STUDY / 01</span>
                  </div>
                )}
              </section>
            )
          }
          case 'text':
            return (
              <section className="text-section" key={key}>
                <Heading>{block.heading}</Heading>
                <p>{block.body}</p>
              </section>
            )
          case 'gallery': {
            const images = (Array.isArray(block.images) ? block.images : [])
              .filter(Boolean)
              .flatMap((item) => {
                const image = visibleMedia(item.image, editorPreview)
                return image ? [{ ...item, image }] : []
              })
            const pair = images.length === 2
            return (
              <section className="gallery-section" key={key}>
                <Heading>{block.heading}</Heading>
                <div className={`gallery${pair ? ' gallery-pair' : ''}`}>
                  {images.map((item, i) => (
                    <BlockImage
                      key={item.id ?? i}
                      image={item.image}
                      size={pair ? 'hero' : 'card'}
                      sizes={`(max-width: 760px) 100vw, ${pair ? '50vw' : '33vw'}`}
                    />
                  ))}
                </div>
              </section>
            )
          }
          case 'imageText': {
            const image = visibleMedia(block.image, editorPreview)
            return (
              <section
                className={`image-text image-${block.imageSide === 'right' ? 'right' : 'left'}`}
                key={key}
              >
                <div className="image-text-copy">
                  <Heading>{block.heading}</Heading>
                  <p>{block.body}</p>
                </div>
                {image ? (
                  <BlockImage image={image} priority={index === 0} />
                ) : (
                  <div className="image-placeholder">
                    <span>Image unavailable</span>
                  </div>
                )}
              </section>
            )
          }
          case 'services':
            return (
              <section className="services-section" key={key}>
                <Heading>{block.heading}</Heading>
                {block.body && <p className="section-intro">{block.body}</p>}
                <ul className="service-cards">
                  {(Array.isArray(block.items) ? block.items : [])
                    .filter(Boolean)
                    .map((item, i) => (
                      <li key={item.id ?? i}>
                        <CardHeading>{item.title}</CardHeading>
                        <p>{item.body}</p>
                        {item.inclusions && (
                          <ul>
                            {item.inclusions
                              .split('\n')
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .map((line, index) => (
                                <li key={index}>{line}</li>
                              ))}
                          </ul>
                        )}
                        {item.priceGuidance && (
                          <p>
                            <strong>Price guidance:</strong> {item.priceGuidance}
                          </p>
                        )}
                        {!editorPreview &&
                          pageId &&
                          item.id &&
                          process.env.LUNIA_SHOWCASE !== 'true' && (
                            <ServiceInquiryLink service={`${pageId}:${item.id}`} />
                          )}
                      </li>
                    ))}
                </ul>
              </section>
            )
          case 'callToAction':
            return (
              <section className="cta-section" key={key}>
                <Heading>{block.heading}</Heading>
                {block.body && <p>{block.body}</p>}
                {block.label && isInternalPagePath(block.href) && (
                  <a className="button-link" href={block.href}>
                    {block.label}
                  </a>
                )}
              </section>
            )
        }
      })}
      {inquiryService && <EnquirySteps />}
    </>
  )
}
