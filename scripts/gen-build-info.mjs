// Generate build-info.ts with commit hash and build time
import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'

let commitHash = ''
try {
  commitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim()
} catch {
  commitHash = 'unknown'
}

const content = `// Auto-generated at build time. Do not edit.
export const COMMIT_HASH = '${commitHash}'
export const BUILD_TIME = '${new Date().toISOString()}'
`

writeFileSync('./src/lib/build-info.ts', content)
console.log('build-info.ts generated')
