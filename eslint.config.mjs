import core from 'eslint-config-next/core-web-vitals'
import ts from 'eslint-config-next/typescript'
const config = [
  ...core,
  ...ts,
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
