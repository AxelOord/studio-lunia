import sharp from 'sharp'
import { test, expect } from '@playwright/test'

test('editor configures reusable blocks and previews a responsive synthetic page', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  expect(
    (
      await request.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).ok(),
  ).toBe(true)
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#c5b8a3"/><circle cx="760" cy="490" r="370" fill="#e9dfcb"/><path d="M0 1400 L620 380 L1200 1500 Z" fill="#7f876f"/><text x="65" y="1430" font-size="35" fill="#292d26">SYNTHETIC COLOUR STUDY</text></svg>',
  )
  const upload = await request.post('/api/media', {
    multipart: {
      _payload: JSON.stringify({
        alt: 'Synthetic colour study — placeholder image',
        visibility: 'private',
      }),
      file: {
        name: `block-study-${Date.now()}.png`,
        mimeType: 'image/png',
        buffer: await sharp(svg).png().toBuffer(),
      },
    },
  })
  expect(upload.ok()).toBe(true)
  const { doc: media } = await upload.json()
  const slug = `block-review-${Date.now()}`
  const created = await request.post('/api/pages', {
    data: {
      title: 'Synthetic block review',
      slug,
      description: 'Synthetic placeholders only; no portfolio or service claims.',
      _status: 'draft',
      layout: [
        {
          blockType: 'hero',
          heading: 'Space for your photographs.',
          eyebrow: 'SYNTHETIC CONTENT PREVIEW',
          body: 'Layout study only. Photography and copy await approval.',
          image: media.id,
        },
        {
          blockType: 'imageText',
          heading: 'A placeholder story.',
          body: 'Use this space for an approved introduction. This synthetic text describes the layout, not the photographer.',
          image: media.id,
        },
        {
          blockType: 'gallery',
          heading: 'Two images, one gallery.',
          images: [{ image: media.id }, { image: media.id }],
        },
        {
          blockType: 'services',
          heading: 'Room for session details.',
          body: 'Example content structure — no bookable services or prices.',
          items: [
            { title: 'Placeholder option one', body: 'An approved description will go here.' },
            { title: 'Placeholder option two', body: 'Another approved description will go here.' },
            { title: 'Placeholder option three', body: 'Details are still awaiting approval.' },
          ],
        },
        {
          blockType: 'text',
          heading: 'Copy comes later.',
          body: 'This page uses synthetic placeholders. <script>window.unsafe = true</script>',
        },
      ],
    },
  })
  expect(created.ok()).toBe(true)
  const { doc } = await created.json()
  expect(doc.layout[1].imageSide).toBe('left')
  try {
    await page.context().addCookies((await request.storageState()).cookies)
    await page.goto(`/admin/collections/pages/${doc.id}`)
    await page
      .locator('#field-layout')
      .getByRole('button', { name: 'Show All', exact: true })
      .first()
      .click()
    await page.getByRole('button', { name: 'Add Layout', exact: true }).click()
    await page.getByRole('button', { name: 'Call to action', exact: true }).click()
    await page.getByRole('button', { name: 'Insert', exact: true }).click()
    await page.locator('#field-layout__5__heading').fill('A simple next step.')
    await page
      .locator('#field-layout__5__body')
      .fill('This link returns home. Booking is not enabled.')
    await page.locator('#field-layout__5__label').fill('Back to the preview')
    await page.locator('#field-layout__5__href').fill('/')
    const splitHeading = page.locator('input[id="field-layout__1__heading"]')
    await splitHeading.fill('An editable placeholder story.')
    await page.locator('#field-layout__1__imageSide').click()
    await page.getByRole('option', { name: 'Right', exact: true }).click()
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/pages/${doc.id}`) && response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
    expect((await saved).ok()).toBe(true)
    await page.reload()
    await page
      .locator('#field-layout')
      .getByRole('button', { name: 'Show All', exact: true })
      .first()
      .click()
    await expect(splitHeading).toHaveValue('An editable placeholder story.')
    await page.screenshot({ path: 'test-results/blocks-admin.png', fullPage: true })
    await page.goto(`/preview?slug=${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Space for your photographs.')
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'An editable placeholder story.',
      'Two images, one gallery.',
      'Room for session details.',
      'Copy comes later.',
      'A simple next step.',
    ])
    await expect(page.locator('.image-text')).toHaveClass(/image-right/)
    const images = page.getByRole('img', { name: 'Synthetic colour study — placeholder image' })
    await expect(images).toHaveCount(4)
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded()
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0)
    }
    await expect(page.locator('.image-text img')).toHaveAttribute('loading', 'lazy')
    await expect(
      page.getByText(
        'This page uses synthetic placeholders. <script>window.unsafe = true</script>',
        { exact: true },
      ),
    ).toBeVisible()
    expect(await page.evaluate(() => 'unsafe' in window)).toBe(false)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `test-results/blocks-${width}.png`, fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      const split = await page.locator('.image-text').evaluate((el) => {
        const copy = el.querySelector('.image-text-copy')!.getBoundingClientRect()
        const image = el.querySelector('img')!.getBoundingClientRect()
        return { copy: { x: copy.x, bottom: copy.bottom }, image: { x: image.x, top: image.top } }
      })
      if (width === 1440) expect(split.image.x).toBeGreaterThan(split.copy.x)
      else expect(split.image.top).toBeGreaterThanOrEqual(split.copy.bottom)
    }
    const cta = page.getByRole('link', { name: 'Back to the preview' })
    await cta.focus()
    await expect(cta).toBeFocused()
    expect(await cta.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('http://127.0.0.1:3000/')
    // Public publication never makes the private split/gallery/hero media public.
    expect(
      (await request.patch(`/api/pages/${doc.id}`, { data: { _status: 'published' } })).ok(),
    ).toBe(true)
    await page.context().clearCookies()
    await page.goto(`/${slug}`)
    await expect(images).toHaveCount(0)
    expect(await page.content()).not.toContain(media.filename)
    // Reordering any block first still yields one useful h1.
    const latest = await (await request.get(`/api/pages/${doc.id}?draft=true`)).json()
    const layout = [...latest.layout].reverse()
    expect(
      (
        await request.patch(`/api/pages/${doc.id}`, { data: { layout, _status: 'published' } })
      ).ok(),
    ).toBe(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A simple next step.')
    expect(errors).toEqual([])
  } finally {
    await request.delete(`/api/pages/${doc.id}`)
    await request.delete(`/api/media/${media.id}`)
  }
})
