export interface DiffLine {
  type: 'same' | 'add' | 'remove'
  value: string
}

export function lineDiff(before: string, after: string): DiffLine[] {
  const left = before.split('\n')
  const right = after.split('\n')
  if (left.length * right.length > 160_000) {
    return [
      ...left.map((value) => ({ type: 'remove' as const, value })),
      ...right.map((value) => ({ type: 'add' as const, value })),
    ]
  }
  const table = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1))
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const output: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      output.push({ type: 'same', value: left[i] })
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      output.push({ type: 'remove', value: left[i] })
      i += 1
    } else {
      output.push({ type: 'add', value: right[j] })
      j += 1
    }
  }
  while (i < left.length) output.push({ type: 'remove', value: left[i++] })
  while (j < right.length) output.push({ type: 'add', value: right[j++] })
  return output
}
