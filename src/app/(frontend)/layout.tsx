import type { Metadata } from 'next'
import Link from 'next/link'
import './styles.css'
import { PrivacyControls } from '@/components/PrivacyControls'
import { draftMode } from 'next/headers'

export const metadata: Metadata = {
  title: { default: 'Studio Lunia', template: '%s · Studio Lunia' },
  description: 'Studio Lunia photography website preview.',
  robots: { index: false, follow: false },
}
export default async function Layout({ children }: { children: React.ReactNode }) {
  const preview = (await draftMode()).isEnabled
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="wordmark" href="/">
            studio lunia<span>PHOTOGRAPHY</span>
          </Link>
          <span className="preview-label">A new chapter, in progress</span>
        </header>
        <PrivacyControls disabled={preview || process.env.LUNIA_SHOWCASE === 'true'}>
          <main id="main">
            {process.env.LUNIA_SHOWCASE === 'true' && (
              <p className="sample-notice">
                Read-only synthetic preview · CMS editing and booking are unavailable.
              </p>
            )}
            {children}
          </main>
          <footer>
            <span className="wordmark">studio lunia</span>
            <p>Website prototype · Synthetic details only. No payments or visitor emails.</p>
            <div className="form-actions">
              <Link href="/inquire">Make an enquiry</Link>
              {process.env.LUNIA_SHOWCASE !== 'true' && (
                <Link href="/studio-days">Explore studio days</Link>
              )}
            </div>
          </footer>
        </PrivacyControls>
      </body>
    </html>
  )
}
