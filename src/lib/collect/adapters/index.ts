import { githubAdapter } from './github-adapter'
import { gitlabAdapter } from './gitlab-adapter'
import { localGitAdapter } from './local-git-adapter'
import type { GitAdapter } from '../types'

const adapters: Record<string, GitAdapter> = {
  'git-remote-github': githubAdapter,
  'git-remote-gitlab': gitlabAdapter,
  'git-local': localGitAdapter,
}

export function getAdapter(type: string): GitAdapter | null {
  return adapters[type] || null
}

export { githubAdapter, gitlabAdapter, localGitAdapter }