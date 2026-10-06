import type { TaskConfig } from 'payload'
import { simulateFollowUp } from './operations'

export const followUpTask: TaskConfig<{
  input: { plan: number; revision: number }
  output: { state: string }
}> = {
  slug: 'simulateFollowUp',
  label: 'Simulate a planned follow-up (no email)',
  inputSchema: [
    { name: 'plan', type: 'number', required: true },
    { name: 'revision', type: 'number', required: true },
  ],
  outputSchema: [{ name: 'state', type: 'text', required: true }],
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 60000 } },
  concurrency: ({ input }) => `followup:${input.plan}`,
  handler: async ({ input, req }) => {
    try {
      return { output: await simulateFollowUp(req.payload, input.plan, input.revision) }
    } catch {
      throw new Error(
        'Follow-up simulation failed. Review the job and retry; no live delivery is enabled.',
      )
    }
  },
}
