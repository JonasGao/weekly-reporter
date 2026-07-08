// Generate build-info.json with version, commit hash, and build time
import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
let commitHash = ''
try {
  commitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim()
} catch {
  commitHash = 'unknown'
}

const info = {
  version: pkg.version,
  commitHash,
  buildTime: new Date().toISOString(),
}

writeFileSync('./public/build-info.json', JSON.stringify(info, null, 2))
console.log('build-info.json generated:', info)
