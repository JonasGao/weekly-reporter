import type { GitAdapter, GitCommit, FetchCommitsOptions, RawEventData } from '../types'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const localGitAdapter: GitAdapter = {
  platform: 'git-local',
  
  async fetchCommits(options: FetchCommitsOptions): Promise<GitCommit[]> {
    const { config, since, until } = options
    const { owner, repo, authorEmails, branch } = config
    
    const repoPath = owner
    
    const args = [
      'log',
      '--pretty=format:%H|%s|%ai|%ae|%an',
      '--no-merges',
    ]
    
    if (since) {
      args.push(`--since=${since.toISOString()}`)
    }
    if (until) {
      args.push(`--until=${until.toISOString()}`)
    }
    if (branch) {
      args.push(branch)
    }
    
    try {
      const { stdout } = await execFileAsync(
        'git', args,
        { cwd: repoPath, maxBuffer: 1024 * 1024 * 10 }
      )
      
      if (!stdout.trim()) {
        return []
      }
      
      const lines = stdout.trim().split('\n')
      const commits: GitCommit[] = lines.map(line => {
        const [sha, message, dateStr, email, name] = line.split('|')
        return {
          sha,
          message,
          authorDate: new Date(dateStr),
          authorEmail: email,
          authorName: name,
          url: '',
        }
      })
      
      return commits.filter(c => authorEmails.includes(c.authorEmail))
    } catch (error) {
      if (error instanceof Error && error.message.includes('not a git repository')) {
        throw new Error(`路径不是 Git 仓库: ${repoPath}`)
      }
      throw new Error(`Git 命令执行失败: ${error}`)
    }
  },
  
  normalizeCommit(commit: GitCommit, source: string, sourceInfo?: { repo?: string; branch?: string; sourceId?: number; sourceName?: string }): RawEventData {
    return {
      eventTime: commit.authorDate,
      source,
      content: commit.message.split('\n')[0],
      metadata: {
        sha: commit.sha,
        url: commit.url,
        repo: sourceInfo?.repo || '',
        branch: sourceInfo?.branch || '',
        sourceId: sourceInfo?.sourceId,
        sourceName: sourceInfo?.sourceName,
      },
      category: '核心开发',
    }
  },
}