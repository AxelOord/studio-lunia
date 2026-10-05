import type { Payload } from 'payload'

export async function notifyPhotographer(payload: Payload, id: number, send: typeof fetch = fetch) {
  // Provider callbacks/exception bodies never enter the lead record or logs.
  if (process.env.LUNIA_CMS_PREVIEW !== 'true') {
    await payload.db.pool.query(
      "UPDATE enquiries SET notification_status = 'disabled' WHERE id = $1 AND notification_status IN ('pending', 'failed')",
      [id],
    )
    return 'disabled'
  }
  const claimed = await payload.db.pool.query<{ notification_attempts: number }>(
    `UPDATE enquiries SET notification_status = 'sending', notification_attempts = notification_attempts + 1, notification_attempted_at = now()
    WHERE id = $1 AND notification_attempts < 3 AND created_at > now() - interval '23 hours'
    AND (notification_status IN ('pending', 'failed') OR (notification_status = 'sending' AND notification_attempted_at < now() - interval '2 minutes')) RETURNING notification_attempts`,
    [id],
  )
  if (!claimed.rowCount) {
    await payload.db.pool.query(
      "UPDATE enquiries SET notification_status = 'manual' WHERE id = $1 AND notification_status IN ('pending', 'failed', 'sending') AND (notification_attempts >= 3 OR created_at <= now() - interval '23 hours')",
      [id],
    )
    return 'unavailable'
  }
  let status = 'failed'
  try {
    if (process.env.RESEND_API_KEY && process.env.PREVIEW_EDITOR_EMAIL && process.env.MAIL_FROM) {
      const result = await send('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `lunia-inquiry-${process.env.VERCEL_GIT_COMMIT_REF}-${id}`,
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: process.env.PREVIEW_EDITOR_EMAIL,
          subject: 'Studio Lunia preview: enquiry to review',
          text: 'A synthetic preview enquiry is ready in Payload. Open the Enquiries collection in your Studio Lunia preview, review the record and update its follow-up status. No visitor email has been sent.',
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (result.ok) status = 'accepted'
    }
  } catch {
    /* The durable failed state is the retry queue. */
  }
  await payload.db.pool.query('UPDATE enquiries SET notification_status = $2 WHERE id = $1', [
    id,
    status,
  ])
  return status
}
