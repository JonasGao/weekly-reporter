import { describe, it, expect } from 'vitest'
import { resolve } from 'path'
import { expandInputPath } from './paths'

describe('expandInputPath', () => {
  const HOME = process.env.HOME || '/home'

  it('expands bare ~ to $HOME', () => {
    expect(expandInputPath('~')).toBe(HOME)
  })

  it('expands ~/... to $HOME/...', () => {
    expect(expandInputPath('~/github/weekly')).toBe(`${HOME}/github/weekly`)
  })

  it('preserves a trailing slash (callers use it to mean "list this directory")', () => {
    expect(expandInputPath('~/')).toBe(`${HOME}/`)
    expect(expandInputPath(`${HOME}/github/`)).toBe(`${HOME}/github/`)
  })

  it('trims surrounding whitespace before expanding', () => {
    expect(expandInputPath('  ~/github  ')).toBe(`${HOME}/github`)
  })

  it('does not support ~user form — treated as a relative path', () => {
    expect(expandInputPath('~god/github')).toBe(`${HOME}/~god/github`)
  })

  it('does not expand ~ when not at the start', () => {
    expect(expandInputPath('/tmp/~weird')).toBe('/tmp/~weird')
  })

  it('resolves relative paths under $HOME', () => {
    expect(expandInputPath('github/weekly')).toBe(`${HOME}/github/weekly`)
  })

  it('normalizes absolute paths', () => {
    expect(expandInputPath('/opt//projects/../repo')).toBe('/opt/repo')
  })

  it('collapses .. segments after expansion', () => {
    expect(expandInputPath('~/../outside')).toBe(resolve(HOME, '../outside'))
  })
})
