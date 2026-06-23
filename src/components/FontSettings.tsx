'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, X } from 'lucide-react'

const DEFAULT_UI_FONT = 'system-ui, sans-serif'
const DEFAULT_EDITOR_FONT = 'Geist, sans-serif'

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

  function handleReset() {
    setUiFont(DEFAULT_UI_FONT)
    setEditorFont(DEFAULT_EDITOR_FONT)
    localStorage.setItem('ui-font', DEFAULT_UI_FONT)
    localStorage.setItem('editor-font', DEFAULT_EDITOR_FONT)
    applyFonts(DEFAULT_UI_FONT, DEFAULT_EDITOR_FONT)
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
            <Label htmlFor="ui-font">界面字体</Label>
            <Input
              id="ui-font"
              value={uiFont}
              onChange={(e) => handleUiFontChange(e.target.value)}
              placeholder="例如：system-ui, sans-serif"
            />
            <p className="text-xs text-muted-foreground">
              用于界面标题、按钮、列表等元素。支持 CSS font-family 格式。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editor-font">编辑器字体</Label>
            <Input
              id="editor-font"
              value={editorFont}
              onChange={(e) => handleEditorFontChange(e.target.value)}
              placeholder="例如：Geist, sans-serif"
            />
            <p className="text-xs text-muted-foreground">
              用于 Markdown 编辑器内容。支持 CSS font-family 格式。
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            重置默认
          </Button>
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