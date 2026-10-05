import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // file-type 22 dynamically imports strtok3's Node entry for temporary uploads.
  // Static tracing sees only strtok3/core; ship the two additional Node files.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/strtok3/lib/index.js', './node_modules/strtok3/lib/FileTokenizer.js'],
  },
  images: {
    // Media visibility is mutable. Never let the optimizer cache an authorized read.
    unoptimized: true,
    localPatterns: [],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
