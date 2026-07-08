'use client'

import { useEffect, useState } from 'react'

interface BuildInfo {
  version: string
  commitHash: string
  buildTime: string
}

export function Footer() {
  const [info, setInfo] = useState<BuildInfo | null>(null)
  const [localTime, setLocalTime] = useState('')

  useEffect(() => {
    fetch('/build-info.json')
      .then(res => res.json())
      .then(setInfo)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (info?.buildTime) {
      const date = new Date(info.buildTime)
      setLocalTime(date.toLocaleString())
    }
  }, [info])

  if (!info) return null

  return (
    <footer className="border-t mt-12 py-4 px-4 text-center text-xs text-muted-foreground">
      v{info.version} · {info.commitHash} · {localTime}
    </footer>
  )
}
