'use client'

import { useEffect, useState } from 'react'

const VERSION = '0.1.0'

interface BuildMeta {
  commitHash: string
  buildTime: string
}

export function Footer() {
  const [meta, setMeta] = useState<BuildMeta | null>(null)
  const [localTime, setLocalTime] = useState('')

  useEffect(() => {
    fetch('/build-info.json')
      .then(res => res.json())
      .then(setMeta)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (meta?.buildTime) {
      const date = new Date(meta.buildTime)
      setLocalTime(date.toLocaleString())
    }
  }, [meta])

  if (!meta) return null

  return (
    <footer className="border-t mt-12 py-4 px-4 text-center text-xs text-muted-foreground">
      v{VERSION} · {meta.commitHash} · {localTime}
    </footer>
  )
}
