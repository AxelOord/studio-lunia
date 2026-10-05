/** The public frontend currently supports / and one lowercase page slug. */
export function isInternalPagePath(value: unknown): value is string {
  return typeof value === 'string' && /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(value)
}
