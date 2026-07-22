'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil, Trash2, Plus, Star, RotateCcw } from 'lucide-react'
import type { AIStyleRow, SystemPromptRow } from '@/lib/db/schema'

const RANDOM_WORDS = [
  'nova', 'apex', 'zen', 'flux', 'core', 'sage', 'echo', 'pulse',
  'spark', 'wave', 'beam', 'dash', 'glow', 'prism', 'forge', 'rift',
  'swift', 'crisp', 'pure', 'bold', 'keen', 'vivid', 'calm', 'dusk',
]

function randomWord(): string {
  return RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)]
}

interface StyleFormData {
  key: string
  label: string
  systemPrompt: string
  temperature: number
  scoreStructureWeight: number
  scoreContentWeight: number
  scoreValueWeight: number
  detailLevel: string
  resultOriented: string
  isDefault: boolean
}

function emptyStyleForm(): StyleFormData {
  return {
    key: randomWord(),
    label: '',
    systemPrompt: '',
    temperature: 0.3,
    scoreStructureWeight: 25,
    scoreContentWeight: 30,
    scoreValueWeight: 45,
    detailLevel: 'medium',
    resultOriented: 'medium',
    isDefault: false,
  }
}

/** 生成新的随机 key */
function regenerateKey(form: StyleFormData, setForm: (f: StyleFormData) => void) {
  setForm({ ...form, key: randomWord() })
}

export function PromptManager() {
  const [activeTab, setActiveTab] = useState<'styles' | 'system'>('styles')

  return (
    <div>
      <div className="flex gap-4 mb-6 border-b">
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'styles'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('styles')}
        >
          风格管理
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'system'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('system')}
        >
          系统提示词
        </button>
      </div>

      {activeTab === 'styles' ? <StyleTab /> : <SystemPromptTab />}
    </div>
  )
}

/** ==================== 风格管理 Tab ==================== */

function StyleTab() {
  const [styles, setStyles] = useState<AIStyleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AIStyleRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<StyleFormData>(emptyStyleForm())
  const [showAdvanced, setShowAdvanced] = useState(false)

  async function fetchStyles() {
    try {
      const res = await fetch('/api/prompts/styles')
      const data = await res.json()
      setStyles(data.styles || [])
    } catch {
      toast.error('加载风格列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStyles() }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyStyleForm())
    setShowAdvanced(false)
    setDialogOpen(true)
  }

  function openEdit(style: AIStyleRow) {
    setEditing(style)
    setForm({
      key: style.key,
      label: style.label,
      systemPrompt: style.systemPrompt,
      temperature: parseFloat(style.temperature),
      scoreStructureWeight: style.scoreStructureWeight,
      scoreContentWeight: style.scoreContentWeight,
      scoreValueWeight: style.scoreValueWeight,
      detailLevel: style.detailLevel ?? 'medium',
      resultOriented: style.resultOriented ?? 'medium',
      isDefault: style.isDefault,
    })
    setShowAdvanced(false)
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      ...form,
      detailLevel: form.detailLevel || undefined,
      resultOriented: form.resultOriented || undefined,
    }

    try {
      if (editing) {
        const res = await fetch(`/api/prompts/styles/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          toast.success('风格已更新')
          setDialogOpen(false)
          fetchStyles()
        } else {
          const err = await res.json()
          toast.error(err.error || '更新失败')
        }
      } else {
        const res = await fetch('/api/prompts/styles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          toast.success('风格已创建')
          setDialogOpen(false)
          fetchStyles()
        } else {
          const err = await res.json()
          toast.error(err.error || '创建失败')
        }
      }
    } catch {
      toast.error('操作失败')
    }
  }

  async function handleDelete(style: AIStyleRow) {
    if (!confirm(`确定要删除风格「${style.label}」吗？`)) return

    try {
      const res = await fetch(`/api/prompts/styles/${style.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('风格已删除')
        fetchStyles()
      } else {
        const err = await res.json()
        toast.error(err.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  async function handleSetDefault(style: AIStyleRow) {
    try {
      const res = await fetch(`/api/prompts/styles/${style.id}`, { method: 'PATCH' })
      if (res.ok) {
        toast.success(`已将「${style.label}」设为默认风格`)
        fetchStyles()
      } else {
        const err = await res.json()
        toast.error(err.error || '设置失败')
      }
    } catch {
      toast.error('设置失败')
    }
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">加载中...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          共 {styles.length} 个风格
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          新建风格
        </Button>
      </div>

      {styles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          暂无风格，点击上方按钮创建
        </div>
      ) : (
        <div className="space-y-2">
          {styles.map((style) => (
            <div
              key={style.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{style.label}</span>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{style.key}</code>
                  {style.isDefault && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      默认
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {style.systemPrompt.slice(0, 60)}...
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!style.isDefault && (
                  <Button size="icon" variant="ghost" title="设为默认" onClick={() => handleSetDefault(style)}>
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => openEdit(style)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(style)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑风格' : '新建风格'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skey">标识 (key)</Label>
                <div className="flex gap-1">
                  <Input
                    id="skey"
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value })}
                    pattern="^[a-z][a-z0-9_-]*$"
                    required
                    className="font-mono text-sm flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title="随机生成"
                    onClick={() => regenerateKey(form, setForm)}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slabel">名称</Label>
                <Input
                  id="slabel"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                  maxLength={50}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprompt">System Prompt</Label>
              <Textarea
                id="sprompt"
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                required
                maxLength={5000}
                className="font-mono text-sm min-h-[200px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.isDefault}
                onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
              />
              <Label>设为默认风格</Label>
            </div>

            {/* 高级参数 */}
            <div>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? '▾' : '▸'} 高级参数
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-4 pl-2 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>Temperature ({form.temperature})</Label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={form.temperature}
                      onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">结构权重</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.scoreStructureWeight}
                        onChange={(e) => setForm({ ...form, scoreStructureWeight: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">内容权重</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.scoreContentWeight}
                        onChange={(e) => setForm({ ...form, scoreContentWeight: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">价值权重</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.scoreValueWeight}
                        onChange={(e) => setForm({ ...form, scoreValueWeight: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">详细程度</Label>
                      <Select
                        value={form.detailLevel || 'medium'}
                        onValueChange={(v) => setForm({ ...form, detailLevel: v as string })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">简洁</SelectItem>
                          <SelectItem value="medium">适中</SelectItem>
                          <SelectItem value="high">详细</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">结果导向</Label>
                      <Select
                        value={form.resultOriented || 'medium'}
                        onValueChange={(v) => setForm({ ...form, resultOriented: v as string })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">低</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="high">高</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">{editing ? '保存' : '创建'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** ==================== 系统提示词 Tab ==================== */

function SystemPromptTab() {
  const [prompts, setPrompts] = useState<SystemPromptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const DEFAULT_CHECK = `你是一个周报写作助手。用户正在写周报，请分析以下内容并给出改进建议。

内容：
{{content}}

{{#section}}当前区块：{{section}}{{/section}}

请从以下方面分析：
1. 是否有具体数据和细节支撑
2. 是否突出了成果和价值
3. 表达是否清晰简洁
4. 是否有更好的表达方式

请给出具体、简洁的建议（每条不超过20字）。
如果内容很好，返回空数组 []。`

  const DEFAULT_SCORE = `你是一个周报评分专家。请对以下周报进行评分和建议。

周报内容：
{{content}}

请从以下维度评分（0-100）：
1. structure（结构完整度）：各区块是否填写完整
2. content（内容充实度）：是否有具体细节和数据
3. value（价值突出度）：是否强调成果和贡献

请给出：
1. 各维度评分
2. 具体改进建议（每条不超过30字）
3. （可选）改写示例`

  async function fetchPrompts() {
    try {
      const res = await fetch('/api/prompts/system')
      const data = await res.json()
      setPrompts(data.prompts || [])
    } catch {
      toast.error('加载系统提示词失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPrompts() }, [])

  function startEdit(key: string, currentText: string) {
    setEditingKey(key)
    setEditText(currentText)
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditText('')
  }

  async function saveEdit(key: string) {
    try {
      const res = await fetch('/api/prompts/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, promptText: editText }),
      })
      if (res.ok) {
        toast.success('提示词已更新')
        setEditingKey(null)
        fetchPrompts()
      } else {
        const err = await res.json()
        toast.error(err.error || '更新失败')
      }
    } catch {
      toast.error('更新失败')
    }
  }

  function resetToDefault(key: string) {
    const def = key === 'check' ? DEFAULT_CHECK : DEFAULT_SCORE
    setEditText(def)
  }

  function getPromptByKey(key: string) {
    return prompts.find((p) => p.key === key)
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">加载中...</div>

  const checkPrompt = getPromptByKey('check')
  const scorePrompt = getPromptByKey('score')

  return (
    <div className="space-y-6">
      {/* 写作建议 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium">写作建议提示词</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              用于实时检查周报内容并给出改进建议。可用变量：
              <code className="bg-muted px-1 rounded">{'{{content}}'}</code>
              <code className="bg-muted px-1 rounded ml-1">{'{{section}}'}</code>
            </p>
          </div>
          {editingKey !== 'check' && (
            <Button size="sm" variant="outline" onClick={() => startEdit('check', checkPrompt?.promptText || DEFAULT_CHECK)}>
              <Pencil className="w-4 h-4 mr-1" />
              编辑
            </Button>
          )}
        </div>

        {editingKey === 'check' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetToDefault('check')}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                重置为默认
              </Button>
            </div>
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={10000}
              className="font-mono text-sm min-h-[400px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>取消</Button>
              <Button size="sm" onClick={() => saveEdit('check')}>保存</Button>
            </div>
          </div>
        ) : (
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-3 max-h-48 overflow-y-auto">
            {checkPrompt?.promptText || '加载中...'}
          </pre>
        )}
      </div>

      {/* 评分提示词 */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium">周报评分提示词</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              用于对完整周报进行多维评分。可用变量：
              <code className="bg-muted px-1 rounded">{'{{content}}'}</code>
            </p>
          </div>
          {editingKey !== 'score' && (
            <Button size="sm" variant="outline" onClick={() => startEdit('score', scorePrompt?.promptText || DEFAULT_SCORE)}>
              <Pencil className="w-4 h-4 mr-1" />
              编辑
            </Button>
          )}
        </div>

        {editingKey === 'score' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetToDefault('score')}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                重置为默认
              </Button>
            </div>
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={10000}
              className="font-mono text-sm min-h-[350px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>取消</Button>
              <Button size="sm" onClick={() => saveEdit('score')}>保存</Button>
            </div>
          </div>
        ) : (
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-3 max-h-48 overflow-y-auto">
            {scorePrompt?.promptText || '加载中...'}
          </pre>
        )}
      </div>
    </div>
  )
}
