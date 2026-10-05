import core from 'eslint-config-next/core-web-vitals'
import ts from 'eslint-config-next/typescript'
const config = [
  ...core,
  ...ts,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: { '@typescript-eslint/no-floating-promises': 'error', 'no-console': 'error' },
  },
  {
    files: [
      'src/admin/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/hosting/PrivateBlobUpload.tsx',
    ],
    ignores: ['**/*.server.ts', '**/*.server.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'payload',
              allowTypeImports: true,
              message:
                'UI code uses authenticated HTTP actions; keep Payload operations in server modules.',
            },
            {
              name: 'pg',
              allowTypeImports: true,
              message: 'Database access belongs in server modules.',
            },
            { name: '@payload-config', message: 'CMS configuration belongs in server modules.' },
          ],
          patterns: [
            {
              group: [
                'node:*',
                '@payloadcms/db-*',
                '**/payload.config',
                '**/inquiries/*',
                '**/customer-records/core',
                '**/customer-records/operations',
                '**/customer-records/mail',
                '**/customer-records/queries',
                '**/customer-records/hooks',
                '**/customer-records/webhook',
                '**/hosting/private-blob',
                '**/hosting/email',
                '**/hosting/rate-limit',
              ],
              allowTypeImports: true,
              message:
                'Keep server data, credentials and provider operations out of UI modules. Share pure types/rendering helpers instead.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      'src/payload-types.ts',
      'src/migrations/**',
      'src/app/(payload)/admin/importMap.js',
      'playwright-report/**',
      'test-results/**',
    ],
  },
]

export default config
