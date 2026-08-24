const activeSourceOperations = new Set<number>()

export class SourceOperationBusyError extends Error {
  constructor(sourceId: number) {
    super(`采集源 ${sourceId} 正在执行其他仓库操作`)
    this.name = 'SourceOperationBusyError'
  }
}

export async function withSourceOperationLock<T>(sourceId: number, operation: () => Promise<T>): Promise<T> {
  if (activeSourceOperations.has(sourceId)) {
    throw new SourceOperationBusyError(sourceId)
  }

  activeSourceOperations.add(sourceId)
  try {
    return await operation()
  } finally {
    activeSourceOperations.delete(sourceId)
  }
}
