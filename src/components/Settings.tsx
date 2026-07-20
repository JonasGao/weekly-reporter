'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Settings as SettingsIcon, X, RefreshCw, TestTube } from 'lucide-react'

const DEFAULT_UI_FONT = 'system-ui, sans-serif'
const DEFAULT_EDITOR_FONT = 'Geist, sans-serif'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('font')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg p-6 w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="font">字体</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
          </TabsList>

          <TabsContent value="font" className="mt-4">
            <FontSettingsTab />
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <AISettingsTab />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={onClose}>完成</Button>
        </div>
      </div>
    </div>
  )
}

function FontSettingsTab() {
  const [uiFont, setUiFont] = useState(() => localStorage.getItem('ui-font') || DEFAULT_UI_FONT)
  const [editorFont, setEditorFont] = useState(() => localStorage.getItem('editor-font') || DEFAULT_EDITOR_FONT)

  useEffect(() => {
    applyFonts(uiFont, editorFont)
  }, [uiFont, editorFont])

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

  return (
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

      <Button variant="outline" onClick={handleReset}>
        重置默认
      </Button>
    </div>
  )
}

function AISettingsTab() {
  const [protocol, setProtocol] = useState<'openai' | 'anthropic'>('openai')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const [model, setModel] = useState('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saved, setSaved] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ai')
      const data = await res.json()
      if (data.configured) {
        setProtocol(data.protocol)
        setApiUrl(data.apiUrl)
        setApiKey('')
        setApiKeyConfigured(data.apiKeyConfigured ?? false)
        setModel(data.model)
        if (data.modelListCache) {
          setAvailableModels(data.modelListCache)
        }
      }
    } catch (error) {
      console.error('Failed to load AI config:', error)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig()
  }, [loadConfig])

  async function handleSave() {
    setLoading(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol, apiUrl, apiKey, model }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        await loadConfig()
      }
    } catch (error) {
      console.error('Failed to save AI config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleFetchModels() {
    if (!apiUrl) return
    setLoading(true)
    try {
      let res
      if (apiKey) {
        res = await fetch('/api/settings/ai/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ protocol, apiUrl, apiKey }),
        })
      } else {
        res = await fetch('/api/settings/ai/models')
      }
      const data = await res.json()
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models)
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      await handleSave()
      const res = await fetch('/api/settings/ai/test', { method: 'POST' })
      const data = await res.json()
      setTestResult({ ok: data.ok, error: data.error })
    } catch (error) {
      setTestResult({ ok: false, error: String(error) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>协议格式</Label>
        <Select value={protocol} onValueChange={(v) => setProtocol(v as 'openai' | 'anthropic')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI Compatible</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          OpenAI Compatible 支持 Qwen、DeepSeek 等兼容接口
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-url">API URL</Label>
        <Input
          id="api-url"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder={protocol === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="api-key">API Key</Label>
        <Input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="space-y-2">
        <Label>模型</Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={model} onValueChange={(v) => setModel(v as string)}>
              <SelectTrigger>
                <SelectValue placeholder="选择模型或手动输入" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length === 0 ? (
                  <SelectItem value="__placeholder__" disabled>
                    暂无可用模型
                  </SelectItem>
                ) : (
                  availableModels.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {protocol === 'openai' && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleFetchModels}
              disabled={loading || !apiUrl || (!apiKey && !apiKeyConfigured)}
              title="刷新模型列表"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
        {protocol === 'openai' && availableModels.length === 0 && (
          <p className="text-xs text-muted-foreground">
            点击刷新按钮自动拉取模型列表，或手动输入模型名称
          </p>
        )}
        {protocol === 'anthropic' && (
          <p className="text-xs text-muted-foreground">
            Anthropic 协议不支持自动拉取，请手动输入模型名称（如 claude-sonnet-4-20250514）
          </p>
        )}
        <Input
          value={model === '__placeholder__' ? '' : model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="或手动输入模型名称"
          className="mt-2"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? '保存中...' : saved ? '已保存 ✓' : '保存'}
        </Button>
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testing || !apiUrl || !apiKey || !model}
        >
          {testing ? (
            <>
              <TestTube className="h-4 w-4 mr-2 animate-pulse" />
              测试中...
            </>
          ) : (
            <>
              <TestTube className="h-4 w-4 mr-2" />
              测试连接
            </>
          )}
        </Button>
      </div>

      {testResult && (
        <div className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
          {testResult.ok ? '✓ 连接成功' : `✗ 连接失败: ${testResult.error}`}
        </div>
      )}
    </div>
  )
}

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
        <SettingsIcon className="h-4 w-4" />
      </Button>
      <Settings isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
