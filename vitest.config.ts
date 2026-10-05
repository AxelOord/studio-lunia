import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    allowOnly: false,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/vitest.xml' },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/*.test.ts'],
          exclude: ['tests/commit-workflow.test.ts'],
          environment: 'node',
          pool: 'forks',
          testTimeout: 20000,
          retry: 0,
        },
      },
      {
        test: {
          name: 'integration',
          setupFiles: ['tests/helpers/integration-setup.ts'],
          include: ['tests/integration/*.test.ts'],
          environment: 'node',
          pool: 'forks',
          maxWorkers: 2,
          testTimeout: 30000,
          hookTimeout: 30000,
          retry: 0,
        },
      },
      {
        test: {
          name: 'build',
          include: ['tests/build/*.test.ts'],
          environment: 'node',
          testTimeout: 30000,
          retry: 0,
        },
      },
    ],
  },
})
