import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const path = searchParams.get('path') || ''
    const owner = searchParams.get('owner') || ''
    const repo = searchParams.get('repo') || ''
    const token = searchParams.get('token') || ''
    const baseUrl = searchParams.get('baseUrl') || ''

    let branches: string[] = []

    if (type === 'git-local' && path) {
      branches = await getLocalBranches(path)
    } else if (type === 'git-remote-github' && owner && repo && token) {
      branches = await getGitHubBranches(owner, repo, token)
    } else if (type === 'git-remote-gitlab' && owner && repo && token) {
      branches = await getGitLabBranches(owner, repo, token, baseUrl)
    } else if (type === 'git-remote-gitee' && owner && repo && token) {
      branches = await getGiteeBranches(owner, repo, token)
    }

    return NextResponse.json({ branches })
  } catch {
    return NextResponse.json({ branches: [] })
  }
}

async function getLocalBranches(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['branch', '-a', '--format=%(refname:short)'], {
      cwd: repoPath,
      maxBuffer: 1024 * 1024,
    })
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(b => b.replace(/^origin\//, ''))
      .filter((b, i, arr) => arr.indexOf(b) === i) // dedupe
      .sort()
  } catch {
    return []
  }
}

async function getGitHubBranches(owner: string, repo: string, token: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )
    if (!res.ok) return []
    const data = (await res.json()) as Array<{ name: string }>
    return data.map(b => b.name).sort()
  } catch {
    return []
  }
}

async function getGitLabBranches(owner: string, repo: string, token: string, baseUrl?: string): Promise<string[]> {
  const host = baseUrl || 'https://gitlab.com'
  const projectPath = encodeURIComponent(`${owner}/${repo}`)
  try {
    const res = await fetch(
      `${host}/api/v4/projects/${projectPath}/repository/branches?per_page=100`,
      { headers: { 'PRIVATE-TOKEN': token } }
    )
    if (!res.ok) return []
    const data = (await res.json()) as Array<{ name: string }>
    return data.map(b => b.name).sort()
  } catch {
    return []
  }
}

async function getGiteeBranches(owner: string, repo: string, token: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://gitee.com/api/v5/repos/${owner}/${repo}/branches?per_page=100&access_token=${token}`,
      {
        headers: { Accept: 'application/json' },
      }
    )
    if (!res.ok) return []
    const data = (await res.json()) as Array<{ name: string }>
    return data.map(b => b.name).sort()
  } catch {
    return []
  }
}
