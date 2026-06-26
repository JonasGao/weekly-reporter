'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Scan, FolderGit2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { scanRepos, batchAddSources } from '@/app/collect/actions'

interface DirectoryItem {
  name: string
  path: string
}

interface FoundRepo {
  path: string
  name: string
  alreadyAdded: boolean
  authorEmails: string[]
}

export function ScanReposDialog({
  open,
  onClose,
  onSuccess
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'scan' | 'result'>('scan')
  const [path, setPath] = useState('')
  const [suggestions, setSuggestions] = useState<DirectoryItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [repos, setRepos] = useState<FoundRepo[]>([])
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    if (open) {
      setStep('scan')
      setPath('')
      setSuggestions([])
      setShowSuggestions(false)
      setRepos([])
      setSelectedRepos(new Set())
    }
  }, [open])
  
  const [activeIndex, setActiveIndex] = useState(-1)
  
  const fetchSuggestions = useCallback(async (currentPath: string) => {
    try {
      const res = await fetch(`/api/collect/scan-path?path=${encodeURIComponent(currentPath)}`)
      const data = await res.json()
      
      if (data.error) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      
      setSuggestions(data.directories || [])
      setShowSuggestions(true)
      setActiveIndex(-1)
    } catch (error) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])
  
  useEffect(() => {
    if (path.length > 0) {
      const timer = setTimeout(() => fetchSuggestions(path), 200)
      return () => clearTimeout(timer)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [path, fetchSuggestions])
  
  function handleSuggestionClick(suggestion: DirectoryItem) {
    setPath(suggestion.path)
    setShowSuggestions(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }
  
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[activeIndex])
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const target = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0]
      handleSuggestionClick(target)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIndex(-1)
    }
  }
  
  async function handleScan() {
    if (!path.trim()) {
      toast.error('请输入路径')
      return
    }
    
    setScanning(true)
    try {
      const result = await scanRepos(path, 3)
      
      if (result.error) {
        toast.error(result.error)
        setScanning(false)
        return
      }
      
      if (result.repos.length === 0) {
        toast.info('未发现 Git 仓库')
        setScanning(false)
        return
      }
      
      setRepos(result.repos.map(repo => ({
        ...repo,
        authorEmails: [],
      })))
      setStep('result')
      toast.success(`发现 ${result.repos.length} 个 Git 仓库`)
    } catch (error) {
      toast.error('扫描失败')
    } finally {
      setScanning(false)
    }
  }
  
  function handleToggleRepo(repoPath: string) {
    const newSelected = new Set(selectedRepos)
    if (newSelected.has(repoPath)) {
      newSelected.delete(repoPath)
    } else {
      newSelected.add(repoPath)
    }
    setSelectedRepos(newSelected)
  }
  
  async function handleBatchAdd() {
    const selected = repos.filter(r => selectedRepos.has(r.path))
    
    if (selected.length === 0) {
      toast.error('请选择要添加的仓库')
      return
    }
    
    setAdding(true)
    try {
      const result = await batchAddSources(selected)
      
      if (result.success) {
        toast.success(`成功添加 ${result.addedCount} 个采集源`)
        onSuccess()
        onClose()
      } else {
        toast.error(result.error || '添加失败')
      }
    } catch (error) {
      toast.error('添加失败')
    } finally {
      setAdding(false)
    }
  }
  
  if (!open) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg mx-4 overflow-visible">
        {step === 'scan' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5" />
                扫描 Git 仓库
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">扫描目录</label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={path}
                    onChange={e => setPath(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder="/home/user/projects"
                    disabled={scanning}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-input rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={suggestion.path}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className={`px-3 py-2 cursor-pointer text-sm ${
                            index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                          }`}
                        >
                          <span className="font-medium">{suggestion.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 truncate">{suggestion.path}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  输入路径会自动显示子目录补全，支持模糊搜索（如 /home/god/git）
                </p>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={handleScan} disabled={scanning || !path.trim()}>
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    扫描中...
                  </>
                ) : (
                  <>
                    <Scan className="h-4 w-4 mr-2" />
                    扫描
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={scanning}>
                取消
              </Button>
            </CardFooter>
          </>
        )}
        
        {step === 'result' && (
          <>
            <CardHeader>
              <CardTitle>扫描结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                找到 {repos.length} 个 Git 仓库：
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {repos.map(repo => (
                  <div
                    key={repo.path}
                    className={`flex items-start gap-3 p-3 rounded-md border ${
                      repo.alreadyAdded ? 'bg-muted opacity-50' : 'bg-background'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRepos.has(repo.path)}
                      onChange={() => handleToggleRepo(repo.path)}
                      disabled={repo.alreadyAdded}
                      className="mt-1 rounded border-input"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{repo.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{repo.path}</p>
                      {repo.alreadyAdded && (
                        <span className="inline-block px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded mt-1">
                          已添加
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button onClick={handleBatchAdd} disabled={adding || selectedRepos.size === 0}>
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    添加中...
                  </>
                ) : (
                  `批量添加 (${selectedRepos.size})`
                )}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={adding}>
                取消
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  )
}