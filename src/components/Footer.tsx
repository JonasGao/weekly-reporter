'use client'

import { useEffect, useState } from 'react'
import { COMMIT_HASH, BUILD_TIME } from '@/lib/build-info'

const VERSION = '0.1.0'

export function Footer() {
  const [localTime, setLocalTime] = useState('')

  useEffect(() => {
    setLocalTime(new Date(BUILD_TIME).toLocaleString())
  }, [])

  return (
    <footer className="border-t mt-12 py-4 px-4 text-center text-xs text-muted-foreground">
      v{VERSION} · {COMMIT_HASH} · {localTime}
    </footer>
  )
}
