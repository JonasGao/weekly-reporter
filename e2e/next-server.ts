import path from 'node:path'

export type NextServerMode = 'development' | 'production'

export const nextServerMode: NextServerMode = process.env.CI ? 'production' : 'development'

export function nextBuildArgs(): string[] {
  return [path.resolve('node_modules/next/dist/bin/next'), 'build']
}

export function nextServeArgs(port: number, mode = nextServerMode): string[] {
  const command = mode === 'production' ? 'start' : 'dev'
  const bundler = mode === 'development' ? ['--webpack'] : []
  return [
    path.resolve('node_modules/next/dist/bin/next'),
    command,
    ...bundler,
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ]
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function nextWebServerCommand(port: number, mode = nextServerMode): string {
  const serve = [process.execPath, ...nextServeArgs(port, mode)].map(shellQuote).join(' ')
  if (mode === 'development') return serve
  return `npm run build && ${serve}`
}
