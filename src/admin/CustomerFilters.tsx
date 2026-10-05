'use client'
import { useState } from 'react'
import { recordURL } from './record-ui'

export function CustomerFilters() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [results, setResults] = useState<{ id: number; name: string; email: string }[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  async function search() {
    setBusy(true)
    try {
      const response = await fetch('/api/customer-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search', query, filter }),
      })
      if (!response.ok) throw new Error('Search could not be loaded. Please retry.')
      const data = await response.json()
      setResults(data.contacts)
      setStatus(
        data.truncated
          ? 'First 50 matches. Narrow your search for more precise results.'
          : `${data.contacts.length} matching contacts.`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Search failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="customer-records">
      <h2>Find customers who need attention</h2>
      <div className="customer-grid">
        <label>
          Name or email
          <input
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void search()
              }
            }}
          />
        </label>
        <label>
          Show contacts
          <select
            aria-label="Show contacts"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All contacts</option>
            <option value="new">New enquiries</option>
            <option value="waiting">Waiting: contacted or proposed</option>
            <option value="upcoming">Upcoming confirmed sessions</option>
            <option value="attention">Email needs attention</option>
          </select>
        </label>
      </div>
      <button type="button" disabled={busy} onClick={() => void search()}>
        Find contacts
      </button>
      <p role="status">{status}</p>
      <ul className="customer-list">
        {results.map((contact) => (
          <li key={contact.id}>
            <a href={recordURL('contacts', contact.id)}>{contact.name}</a>
            <span className="customer-meta">{contact.email}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
