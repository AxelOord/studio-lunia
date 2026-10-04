import type { Access } from 'payload'

export const editors: Access = ({ req }) => Boolean(req.user)
export const publishedOrEditor: Access = ({ req }) =>
  req.user ? true : { _status: { equals: 'published' } }
export const publicMediaOrEditor: Access = ({ req }) =>
  req.user ? true : { visibility: { equals: 'public' } }
