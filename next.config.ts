import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * The rubric markdown is read off disk at request time and fed to the model whole. Vercel
   * only ships files it can see being imported, and a runtime readFileSync is invisible to
   * that analysis, so the files have to be named explicitly or the deployed function finds an
   * empty directory. This is the price of keeping rubrics/*.md as the single source of truth
   * instead of copying them into a TypeScript string that could drift.
   */
  outputFileTracingIncludes: {
    '/api/runs': ['./rubrics/**'],
  },
}

export default nextConfig
