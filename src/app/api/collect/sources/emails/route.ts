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
    const branch = searchParams.get('branch') || ''

    let emails: string[] = []

    if (type === 'git-local' && path) {
      emails = await getLocalEmails(path, branch)
    } else if (type === 'git-remote-github' && owner && repo && token) {
      emails = await getGitHubEmails(owner, repo, token)
    } else if (type === 'git-remote-gitlab' && owner && repo && token) {
      emails = await getGitLabEmails(owner, repo, token, baseUrl)
    }

    return NextResponse.json({ emails: [...new Set(emails)].filter(Boolean).sort() })
  } catch {
    return NextResponse.json({ emails: [] })
  }
}

async function getLocalEmails(repoPath: string, branch?: string): Promise<string[]> {
  const args = ['log', '--pretty=format:%ae', '--no-merges', '-200']
  if (branch) args.push(branch)
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 1024 * 1024,
    })
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

async function getGitHubEmails(owner: string, repo: string, token: string): Promise<string[]> {
  const emails: string[] = []
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )
    if (!res.ok) return []
    const commits = (await res.json()) as Array<{
      author?: { email?: string }
      commit?: { author?: { email?: string } }
    }>
    for (const c of commits) {
      const email = c.author?.email || c.commit?.author?.email
      if (email) emails.push(email)
    }
  } catch {
    // ignore
  }
  return emails
}

async function getGitLabEmails(owner: string, repo: string, token: string, baseUrl?: string): Promise<string[]> {
  const emails: string[] = []
  const host = baseUrl || 'https://gitlab.com'
  const projectPath = encodeURIComponent(`${owner}/${repo}`)
  try {
    const res = await fetch(
      `${host}/api/v4/projects/${projectPath}/repository/commits?per_page=100`,
      { headers: { 'PRIVATE-TOKEN': token } }
    )
    if (!res.ok) return []
    const commits = (await res.json()) as Array<{ author_email?: string }>
    for (const c of commits) {
      if (c.author_email) emails.push(c.author_email)
    }
  } catch {
    // ignore
  }
  return emails
}
