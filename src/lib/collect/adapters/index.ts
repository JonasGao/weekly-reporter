import { githubAdapter } from './github-adapter'
import { gitlabAdapter } from './gitlab-adapter'
import type { GitAdapter } from '../types'

const adapters: Record<string, GitAdapter> = {
  'git-remote-github': githubAdapter,
  'git-remote-gitlab': gitlabAdapter,
}

export function getAdapter(type: string): GitAdapter | null {
  return adapters[type] || null
}

export { githubAdapter, gitlabAdapter }