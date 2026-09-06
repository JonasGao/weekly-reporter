'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Expand, Palette, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import type { AIStyle } from '@/lib/db/schema'

interface AIAssistantPanelProps {
  reportId: number
  templateId?: number
  styleOverride?: AIStyle
  // Editor integration callbacks
  onPolish?: (polishedContent: string) => void
  onExpand?: (expandedContent: string) => void
  onUnify?: (unifiedContent: string) => void
  // Optional: get current editor content
  getEditorContent?: () => string
}

interface ErrorState {
  operation: string
  message: string
  canRetry: boolean
}

export function AIAssistantPanel({ 
  reportId, 
  templateId, 
  styleOverride,
  onPolish,
  onExpand,
  onUnify,
  getEditorContent,
}: AIAssistantPanelProps) {
  const [selectedEvent, setSelectedEvent] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Helper to get content to process
  const getContentToProcess = () => {
    // If there's selected text in the textarea, use it
    if (selectedEvent.trim()) {
      return selectedEvent
    }
    // Otherwise, try to get from editor
    if (getEditorContent) {
      const editorContent = getEditorContent()
      if (editorContent.trim()) {
        return editorContent
      }
    }
    return ''
  }

  const clearError = () => setError(null)

  const handlePolish = async () => {
    const contentToPolish = getContentToProcess()
    
    if (!contentToPolish.trim()) {
      toast.error('Select or enter text to polish')
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController
    abortControllerRef.current = new AbortController()

    setLoading('polish')
    setError(null)
    
    try {
      const response = await fetch('/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: contentToPolish,
          templateId,
          styleOverride,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Polish service is temporarily unavailable' }))
        throw new Error(errorData.error || 'Polish failed')
      }

      const data = await response.json()
      toast.success('Polished successfully!')
      
      // Call the callback to update editor
      if (onPolish) {
        onPolish(data.polishedContent)
      }
      
      // Clear the textarea after successful polish
      setSelectedEvent('')
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Network error. Check your connection.'
      setError({
        operation: 'polish',
        message: errorMessage,
        canRetry: true,
      })
      toast.error(errorMessage)
      console.error('Polish error:', error)
    } finally {
      setLoading(null)
      abortControllerRef.current = null
    }
  }

  const handleExpand = async () => {
    const contentToExpand = getContentToProcess()
    
    if (!contentToExpand.trim()) {
      toast.error('Select or enter text to expand')
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController
    abortControllerRef.current = new AbortController()

    setLoading('expand')
    setError(null)
    
    try {
      const response = await fetch('/api/ai/expand-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentToExpand,
          templateId,
          styleOverride,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Expansion service is temporarily unavailable' }))
        throw new Error(errorData.error || 'Expansion failed')
      }

      const data = await response.json()
      toast.success('Expanded successfully!')
      
      // Call the callback to update editor
      if (onExpand) {
        onExpand(data.expandedContent)
      }
      
      // Clear the textarea after successful expand
      setSelectedEvent('')
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Network error. Check your connection.'
      setError({
        operation: 'expand',
        message: errorMessage,
        canRetry: true,
      })
      toast.error(errorMessage)
      console.error('Expand error:', error)
    } finally {
      setLoading(null)
      abortControllerRef.current = null
    }
  }

  const handleUnify = async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController
    abortControllerRef.current = new AbortController()

    setLoading('unify')
    setError(null)
    
    try {
      const response = await fetch('/api/ai/unify-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          templateId,
          styleOverride,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Style service is temporarily unavailable' }))
        throw new Error(errorData.error || 'Style unification failed')
      }

      const data = await response.json()
      toast.success('Style unified successfully!')
      
      // Call the callback to update editor
      if (onUnify) {
        onUnify(data.unifiedContent)
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Network error. Check your connection.'
      setError({
        operation: 'unify',
        message: errorMessage,
        canRetry: true,
      })
      toast.error(errorMessage)
      console.error('Unify error:', error)
    } finally {
      setLoading(null)
      abortControllerRef.current = null
    }
  }

  const handleRetry = () => {
    if (!error) return
    
    clearError()
    
    // Retry the failed operation
    if (error.operation === 'polish') {
      handlePolish()
    } else if (error.operation === 'expand') {
      handleExpand()
    } else if (error.operation === 'unify') {
      handleUnify()
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Select event
        </label>
        <textarea
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          placeholder="Select text in the editor, or enter report content here..."
          className="w-full min-h-[120px] px-3 py-2 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all"
          disabled={loading !== null}
        />
      </div>

      {/* Error display with retry button */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">Operation failed</p>
              <p className="text-xs text-destructive/80 mt-1">{error.message}</p>
            </div>
            {error.canRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="h-7 text-xs gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          AI assistant actions
        </label>
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePolish}
            disabled={loading !== null}
            className="justify-start h-auto py-2.5"
          >
            {loading === 'polish' ? (
              <Loader2 className="h-4 w-4 mr-2 flex-shrink-0 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2 flex-shrink-0" />
            )}
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">
                {loading === 'polish' ? 'Polishing...' : 'Polish text'}
              </span>
              <span className="text-xs text-muted-foreground">
                Improve wording and professionalism
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExpand}
            disabled={loading !== null}
            className="justify-start h-auto py-2.5"
          >
            {loading === 'expand' ? (
              <Loader2 className="h-4 w-4 mr-2 flex-shrink-0 animate-spin" />
            ) : (
              <Expand className="h-4 w-4 mr-2 flex-shrink-0" />
            )}
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">
                {loading === 'expand' ? 'Expanding...' : 'Expand content'}
              </span>
              <span className="text-xs text-muted-foreground">
                Add detail and richer descriptions
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleUnify}
            disabled={loading !== null}
            className="justify-start h-auto py-2.5"
          >
            {loading === 'unify' ? (
              <Loader2 className="h-4 w-4 mr-2 flex-shrink-0 animate-spin" />
            ) : (
              <Palette className="h-4 w-4 mr-2 flex-shrink-0" />
            )}
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">
                {loading === 'unify' ? 'Unifying style...' : 'Unify style'}
              </span>
              <span className="text-xs text-muted-foreground">
                Adjust the whole report for consistency
              </span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  )
}
