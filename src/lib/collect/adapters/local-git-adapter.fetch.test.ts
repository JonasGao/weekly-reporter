import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fetchOrigin } from './local-git-adapter'

const run = promisify(execFile)
const tempDirs: string[] = []

async function git(cwd: string, args: string[]) {
  await run('git', args, { cwd })
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('fetchOrigin', () => {
  it('fetches the origin remote without changing the working tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'weekly-reporter-fetch-'))
    tempDirs.push(root)
    const remote = join(root, 'remote.git')
    const repo = join(root, 'repo')

    await git(root, ['init', '--bare', remote])
    await git(root, ['init', repo])
    await git(repo, ['config', 'user.email', 'test@example.com'])
    await git(repo, ['config', 'user.name', 'Test'])
    await writeFile(join(repo, 'README.md'), 'test\n')
    await git(repo, ['add', 'README.md'])
    await git(repo, ['commit', '-m', 'initial'])
    await git(repo, ['remote', 'add', 'origin', remote])
    await git(repo, ['push', '-u', 'origin', 'HEAD'])

    await expect(fetchOrigin(repo)).resolves.toBeUndefined()
  })

  it('rejects a repository without origin', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'weekly-reporter-fetch-'))
    tempDirs.push(repo)
    await git(repo, ['init'])

    await expect(fetchOrigin(repo)).rejects.toThrow('仓库未配置 origin 远端')
  })
})
