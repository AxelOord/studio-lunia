import type { Payload } from 'payload'
import { preparePhotographerNotice, sendEmailMessage } from '../customer-records/mail'

export async function notifyPhotographer(payload: Payload, id: number, send: typeof fetch = fetch) {
  const message = await preparePhotographerNotice(payload, id)
  return typeof message === 'number' ? sendEmailMessage(payload, message, send) : message
}
