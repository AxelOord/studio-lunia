'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { experimentReport } from '../experiments/server'
import { WorkspaceShell, workspaceJSON } from './workspace-ui'
import './experiments.css'

type Report = Awaited<ReturnType<typeof experimentReport>>
const percent = (value: number) => (value * 100).toFixed(1) + '%'
export function ExperimentResults({ report, error }: { report?: Report; error: string }) {
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  async function action(id: number, action: string, variant?: string) {
    setBusy(true)
    setActionError('')
    try {
      const result = await workspaceJSON<{ href: string }>('/api/experiments/manage', {
        id,
        action,
        variant,
      })
      window.location.assign(result.href)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Please retry.')
      setBusy(false)
    }
  }
  return (
    <WorkspaceShell
      title="Page experiments"
      description="Plan a focused CTA change, rehearse the complete enquiry journey, and review the evidence."
      actions={
        <Link className="experiment-create" href="/admin/collections/experiments/create">
          New experiment
        </Link>
      }
    >
      <section className="workspace-card experiment-summary" aria-label="Experiment safeguards">
        <h2>
          {!report
            ? 'Experiment status unavailable'
            : report.enabled
              ? 'Live delivery enabled'
              : 'Live delivery disabled'}
        </h2>
        <p>
          Prepared plans only run when their runtime gate allows it. Staff simulations are separate
          from live results. No analytics provider is required.
        </p>
        <p>
          <strong>No winner is declared.</strong> Counts reflect consenting browser identifiers, not
          people. Descriptive 95% intervals do not establish significance or justify stopping a
          test.
        </p>
      </section>
      {(error || actionError) && (
        <div role="alert">
          <p>{error || actionError}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload results
          </button>
        </div>
      )}
      {report && !report.experiments.length && (
        <section className="workspace-card">
          <h2>No experiments yet</h2>
          <p>
            Create a simulation with a hypothesis and a published service landing. Record the
            baseline and sample plan before preparing it.
          </p>
        </section>
      )}
      {report?.experiments.map((experiment) => (
        <section
          key={experiment.id}
          className="workspace-card experiment-card"
          aria-label={experiment.name}
        >
          <header>
            <div>
              <span className="workspace-badge">
                {experiment.mode === 'simulation' ? 'Simulation · synthetic results' : 'Live plan'}{' '}
                · {experiment.state}
              </span>
              <h2>
                <Link href={`/admin/collections/experiments/${experiment.id}`}>
                  {experiment.name}
                </Link>
              </h2>
            </div>
            <Link
              href={`/admin/collections/pages/${typeof experiment.page === 'number' ? experiment.page : experiment.page.id}`}
            >
              Open landing page
            </Link>
          </header>
          <p>{experiment.hypothesis}</p>
          <p className="experiment-definition">
            Audience: consenting browsers on the selected published service landing. Primary
            outcome: at least one saved matching enquiry within 30 days of visible CTA exposure.
          </p>
          <div className="experiment-variants">
            {experiment.variants.map((row) => (
              <article key={row.variant}>
                <h3>
                  {row.variant === 'control' ? 'Original · control' : 'Alternate · treatment'}
                </h3>
                <p className="experiment-copy">
                  “{row.variant === 'control' ? experiment.controlLabel : experiment.treatmentLabel}
                  ”
                </p>
                <p>
                  Allocation:{' '}
                  {row.variant === 'control'
                    ? 100 - experiment.treatmentPercent
                    : experiment.treatmentPercent}
                  %
                </p>
                <dl>
                  <div>
                    <dt>Assigned</dt>
                    <dd>{row.assigned}</dd>
                  </div>
                  <div>
                    <dt>Exposed</dt>
                    <dd>{row.exposed}</dd>
                  </div>
                  <div>
                    <dt>Converted</dt>
                    <dd>{row.converted}</dd>
                  </div>
                </dl>
                <p>
                  <strong>{row.interval ? percent(row.interval.rate) : 'No exposure data'}</strong>
                  {row.interval && ` · ${row.converted} / ${row.exposed} exposed browsers`}
                </p>
                <p>
                  {row.interval
                    ? `Descriptive 95% interval: ${percent(row.interval.lower)}–${percent(row.interval.upper)}`
                    : 'Conversion rate and uncertainty are unavailable.'}
                </p>
                {experiment.state === 'stopped' && (
                  <button
                    className="workspace-button"
                    disabled={busy}
                    onClick={() => void action(experiment.id, 'retain', row.variant)}
                  >
                    Copy {row.variant === 'control' ? 'original' : 'alternate'} to page draft
                  </button>
                )}
              </article>
            ))}
          </div>
          <p>
            <strong>
              {experiment.thresholdsMet
                ? 'Plan thresholds reached · human review required'
                : 'Insufficient planned sample or duration'}
            </strong>
            <br />
            Plan: at least {experiment.minimumPerVariant.toLocaleString()} exposed browsers per
            variant and {experiment.durationDays} days. Observed duration: {experiment.elapsedDays}{' '}
            complete days from first exposure.
          </p>
          <details>
            <summary>Baseline, sample plan and limitations</summary>
            <h3>Baseline</h3>
            <p>{experiment.baseline || 'Not recorded'}</p>
            <h3>Traffic and stopping plan</h3>
            <p>{experiment.trafficPlan || 'Not recorded'}</p>
            <p>
              Intervals assume independent binary outcomes. Cookie clearing, consent changes,
              blocking, repeat browsers, uneven samples and missing events limit interpretation. No
              significance test, power calculation or correction for repeated peeking is performed.
              Exposure can be missed during fast navigation. Outcomes are saved enquiries, not
              qualified leads, bookings or revenue.
            </p>
            <p>
              Review consent coverage, allocation balance, baseline, minimum detectable effect and a
              pre-agreed analysis/stopping plan before a live launch. Crossing thresholds never
              proves a winner.
            </p>
          </details>
          <div className="experiment-actions">
            {experiment.state === 'ready' && experiment.mode === 'simulation' && (
              <button
                className="workspace-button"
                disabled={busy}
                onClick={() => void action(experiment.id, 'simulate')}
              >
                Try simulation on landing
              </button>
            )}
            {experiment.state === 'ready' && (
              <button
                className="workspace-button"
                disabled={busy}
                onClick={() => void action(experiment.id, 'stop')}
              >
                Stop experiment
              </button>
            )}
          </div>
          {experiment.state === 'stopped' && (
            <p>
              Stopped permanently. Copying saves only the CTA text to the current page draft; review
              and publish it separately. No winner is inferred.
            </p>
          )}
        </section>
      ))}
      {report && report.totalPages > 1 && (
        <nav aria-label="Experiment result pages" className="experiment-actions">
          {report.page > 1 && (
            <Link href={`/admin/experiments?page=${report.page - 1}`}>Previous</Link>
          )}
          <span>
            Page {report.page} of {report.totalPages}
          </span>
          {report.page < report.totalPages && (
            <Link href={`/admin/experiments?page=${report.page + 1}`}>Next</Link>
          )}
        </nav>
      )}
    </WorkspaceShell>
  )
}
