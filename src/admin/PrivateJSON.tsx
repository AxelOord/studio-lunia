'use client'
import { useField } from '@payloadcms/ui'

/** Inert private snapshot display: no remote code editor or editor write control. */
export function PrivateJSON({ path }: { path: string }) {
  const { value } = useField({ path })
  return (
    <details>
      <summary>Recorded snapshot</summary>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </details>
  )
}
