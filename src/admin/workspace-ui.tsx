'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { blockLabels, purposeLabels } from '../followups/domain'
import type { FollowUp } from '../payload-types'
import './workspace.css'

export async function workspaceJSON<T>(url: string, input?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    ...(input
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      : {}),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  })
  if (response.status === 401) throw new Error('Your session expired. Sign in again, then retry.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'This view could not load. Try again.')
  return data as T
}
export function WorkspaceNav() {
  const params = useSearchParams()
  const filter = ['all', 'new', 'waiting', 'upcoming', 'attention'].includes(
    params.get('filter') || '',
  )
    ? params.get('filter')
    : 'all'
  const page = /^\d{1,4}$/.test(params.get('page') || '') ? params.get('page') : '1'
  return (
    <nav className="workspace-nav" aria-label="Customer work">
      <Link href={`/admin?filter=${filter}&page=${page}`}>Enquiry inbox</Link>
      <Link href="/admin/follow-ups">Follow-ups</Link>
      <Link href="/admin/collections/email-templates">Email templates</Link>
    </nav>
  )
}
export function WorkspaceShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="workspace">
      <WorkspaceNav />
      <header className="workspace-header">
        <p className="workspace-eyebrow">Studio Lunia · Customer care</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <p className="workspace-notice">
        Test workspace · Follow-ups run only when you request a simulation. No customer email is
        sent. Real incoming replies and scheduled delivery are not connected.
      </p>
      {children}
    </main>
  )
}
export function PlanSummary({ plan }: { plan: FollowUp }) {
  return (
    <>
      <span className={`workspace-badge state-${plan.state}`}>{plan.state}</span>
      <h3>{plan.subject}</h3>
      <p>
        {purposeLabels[plan.purpose]} ·{' '}
        {new Intl.DateTimeFormat('en-GB', {
          timeZone: plan.timeZone,
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(plan.plannedAt))}
        <br />
        Plan timezone: {plan.timeZone}
      </p>
      {plan.blockReason && (
        <p className="workspace-reason">
          {blockLabels[plan.blockReason] || 'Review this plan before continuing.'}
        </p>
      )}
      {plan.lastError && <p role="alert">{plan.lastError}</p>}
    </>
  )
}
export function currencyAmount(minor: number, currency: string) {
  const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency })
  return formatter.format(minor / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2))
}
export function minorAmount(value: string, currency: string) {
  const places =
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  const amount = Number(value) * 10 ** places
  if (
    !/^\d+(\.\d+)?$/.test(value) ||
    !Number.isSafeInteger(Math.round(amount)) ||
    Math.abs(amount - Math.round(amount)) > 0.000001
  )
    throw new Error('Enter an amount with the correct number of decimal places for this currency.')
  return Math.round(amount)
}
