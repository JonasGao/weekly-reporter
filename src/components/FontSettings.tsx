'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, X } from 'lucide-react'

const DEFAULT_UI_FONT = 'system-ui, sans-serif'
const DEFAULT_EDITOR_FONT = 'Geist, sans-serif'
const DEFAULT_RENDERING = 'default'

type FontRendering = 'default' | 'antialiased' | 'subpixel' | 'geometric'

interface FontSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function FontSettings({ isOpen, onClose }: FontSettingsProps) {
  const [uiFont, setUiFont] = useState(DEFAULT_UI_FONT)
  const [editorFont, setEditorFont] = useState(DEFAULT_EDITOR_FONT)
  const [uiRendering, setUiRendering] = useState<FontRendering>(DEFAULT_RENDERING)
  const [editorRendering, setEditorRendering] = useState<FontRendering>(DEFAULT_RENDERING)

  useEffect(() => {
    const savedUiFont = localStorage.getItem('ui-font') || DEFAULT_UI_FONT
    const savedEditorFont = localStorage.getItem('editor-font') || DEFAULT_EDITOR_FONT
    const savedUiRendering = (localStorage.getItem('ui-rendering') as FontRendering) || DEFAULT_RENDERING
    const savedEditorRendering = (localStorage.getItem('editor-rendering') as FontRendering) || DEFAULT_RENDERING
    
    setUiFont(savedUiFont)
    setEditorFont(savedEditorFont)
    setUiRendering(savedUiRendering)
    setEditorRendering(savedEditorRendering)
    applyFonts(savedUiFont, savedEditorFont, savedUiRendering, savedEditorRendering)
  }, [])

  function applyFonts(uiFont: string, editorFont: string, uiRendering: FontRendering, editorRendering: FontRendering) {
    document.documentElement.style.setProperty('--font-ui', uiFont)
    document.documentElement.style.setProperty('--font-editor', editorFont)
    
    const uiStyles = getRenderingStyles(uiRendering)
    const editorStyles = getRenderingStyles(editorRendering)
    
    document.documentElement.style.setProperty('--font-ui-rendering', uiStyles.webkit)
    document.documentElement.style.setProperty('--font-ui-moz-rendering', uiStyles.moz)
    document.documentElement.style.setProperty('--font-ui-text-rendering', uiStyles.textRendering)
    
    document.documentElement.style.setProperty('--font-editor-rendering', editorStyles.webkit)
    document.documentElement.style.setProperty('--font-editor-moz-rendering', editorStyles.moz)
    document.documentElement.style.setProperty('--font-editor-text-rendering', editorStyles.textRendering)
  }

  function getRenderingStyles(rendering: FontRendering) {
    switch (rendering) {
      case 'antialiased':
        return { webkit: 'antialiased', moz: 'grayscale', textRendering: 'optimizeLegibility' }
      case 'subpixel':
        return { webkit: 'subpixel-antialiased', moz: 'auto', textRendering: 'auto' }
      case 'geometric':
        return { webkit: 'antialiased', moz: 'grayscale', textRendering: 'geometricPrecision' }
      default:
        return { webkit: '', moz: '', textRendering: '' }
    }
  }

  function handleUiFontChange(font: string) {
    setUiFont(font)
    localStorage.setItem('ui-font', font)
    applyFonts(font, editorFont, uiRendering, editorRendering)
  }

  function handleEditorFontChange(font: string) {
    setEditorFont(font)
    localStorage.setItem('editor-font', font)
    applyFonts(uiFont, font, uiRendering, editorRendering)
  }

  function handleUiRenderingChange(rendering: FontRendering | null) {
    if (!rendering) return
    setUiRendering(rendering)
    localStorage.setItem('ui-rendering', rendering)
    applyFonts(uiFont, editorFont, rendering, editorRendering)
  }

  function handleEditorRenderingChange(rendering: FontRendering | null) {
    if (!rendering) return
    setEditorRendering(rendering)
    localStorage.setItem('editor-rendering', rendering)
    applyFonts(uiFont, editorFont, uiRendering, rendering)
  }

  function handleReset() {
    setUiFont(DEFAULT_UI_FONT)
    setEditorFont(DEFAULT_EDITOR_FONT)
    setUiRendering(DEFAULT_RENDERING)
    setEditorRendering(DEFAULT_RENDERING)
    localStorage.setItem('ui-font', DEFAULT_UI_FONT)
    localStorage.setItem('editor-font', DEFAULT_EDITOR_FONT)
    localStorage.setItem('ui-rendering', DEFAULT_RENDERING)
    localStorage.setItem('editor-rendering', DEFAULT_RENDERING)
    applyFonts(DEFAULT_UI_FONT, DEFAULT_EDITOR_FONT, DEFAULT_RENDERING, DEFAULT_RENDERING)
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
            <Label htmlFor="ui-rendering">界面字体渲染</Label>
            <Select value={uiRendering} onValueChange={handleUiRenderingChange}>
              <SelectTrigger id="ui-rendering">
                <SelectValue placeholder="选择渲染模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认</SelectItem>
                <SelectItem value="antialiased">抗锯齿（平滑）</SelectItem>
                <SelectItem value="subpixel">次像素（清晰）</SelectItem>
                <SelectItem value="geometric">几何精度（精细）</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              控制字体的抗锯齿和渲染方式。
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

          <div className="space-y-2">
            <Label htmlFor="editor-rendering">编辑器字体渲染</Label>
            <Select value={editorRendering} onValueChange={handleEditorRenderingChange}>
              <SelectTrigger id="editor-rendering">
                <SelectValue placeholder="选择渲染模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认</SelectItem>
                <SelectItem value="antialiased">抗锯齿（平滑）</SelectItem>
                <SelectItem value="subpixel">次像素（清晰）</SelectItem>
                <SelectItem value="geometric">几何精度（精细）</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              控制编辑器字体的抗锯齿和渲染方式。
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