'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Settings, X } from 'lucide-react'

const FONT_OPTIONS = [
  { value: 'system-ui', label: '系统默认' },
  { value: 'Geist', label: 'Geist' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Noto Sans SC', label: '思源黑体' },
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'PingFang SC', label: '苹方' },
  { value: 'SimSun', label: '宋体' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Monaco', label: 'Monaco' },
]

const DEFAULT_UI_FONT = 'system-ui'
const DEFAULT_EDITOR_FONT = 'Geist'

interface FontSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function FontSettings({ isOpen, onClose }: FontSettingsProps) {
  const [uiFont, setUiFont] = useState(DEFAULT_UI_FONT)
  const [editorFont, setEditorFont] = useState(DEFAULT_EDITOR_FONT)

  useEffect(() => {
    const savedUiFont = localStorage.getItem('ui-font') || DEFAULT_UI_FONT
    const savedEditorFont = localStorage.getItem('editor-font') || DEFAULT_EDITOR_FONT
    setUiFont(savedUiFont)
    setEditorFont(savedEditorFont)
    applyFonts(savedUiFont, savedEditorFont)
  }, [])

  function applyFonts(uiFont: string, editorFont: string) {
    document.documentElement.style.setProperty('--font-ui', uiFont)
    document.documentElement.style.setProperty('--font-editor', editorFont)
  }

  function handleUiFontChange(font: string) {
    setUiFont(font)
    localStorage.setItem('ui-font', font)
    applyFonts(font, editorFont)
  }

  function handleEditorFontChange(font: string) {
    setEditorFont(font)
    localStorage.setItem('editor-font', font)
    applyFonts(uiFont, font)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">字体设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">界面字体</label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={uiFont}
              onChange={(e) => handleUiFontChange(e.target.value)}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              用于界面标题、按钮、列表等元素
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">编辑器字体</label>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={editorFont}
              onChange={(e) => handleEditorFontChange(e.target.value)}
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              用于 Markdown 编辑器内容
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>完成</Button>
        </div>
      </div>
    </div>
  )
}

export function FontSettingsButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
        <Settings className="h-4 w-4" />
      </Button>
      <FontSettings isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}