export function validSlug(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  )
}
