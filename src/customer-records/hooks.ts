import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook } from 'payload'
import { activity, recordContext, relationID } from './core'

export const linkNewEnquiry: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') {
    if ('contact' in data && !relationID(data.contact))
      throw new APIError('An enquiry must stay linked to a contact.', 422)
    return data
  }
  const contact = await req.payload.create({
    collection: 'contacts',
    req,
    context: { ...req.context, ...recordContext },
    overrideAccess: false,
    data: { name: data.name, email: data.email, sourceKey: `enquiry:${data.submissionHash}` },
    depth: 0,
  })
  return { ...data, contact: contact.id }
}
export const enquiryActivity: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const contact = relationID(doc.contact)
  if (!contact) return doc
  const created = operation === 'create'
  if (
    created ||
    doc.followUp !== previousDoc.followUp ||
    contact !== relationID(previousDoc.contact)
  ) {
    await activity(req, {
      contact,
      enquiry: doc.id,
      kind: created ? 'enquiry_received' : 'enquiry_updated',
      summary: created
        ? 'Enquiry received'
        : contact !== relationID(previousDoc.contact)
          ? 'Enquiry explicitly linked to this contact'
          : `Enquiry follow-up: ${doc.followUp}`,
      source: created ? 'website' : 'staff',
      details: created
        ? {}
        : {
            previousFollowUp: previousDoc.followUp,
            followUp: doc.followUp,
            previousContact: relationID(previousDoc.contact) || null,
          },
    })
  }
  return doc
}
export const contactActivity: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation === 'update') {
    const changed = ['name', 'email', 'phone', 'notes'].filter(
      (key) => doc[key] !== previousDoc[key],
    )
    if (changed.length)
      await activity(req, {
        contact: doc.id,
        kind: 'contact_corrected',
        summary: 'Contact details corrected',
        source: 'staff',
        details: { changedFields: changed },
      })
  }
  return doc
}
