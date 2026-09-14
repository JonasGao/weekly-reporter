'use client'

import { Button } from '@/components/ui/button'
import { Sparkles, Expand, Palette, Loader2, RefreshCw } from 'lucide-react'
import { useAIActions } from './useAIActions'

interface AIAssistantPanelProps {
  reportId: number
  templateId?: number
  styleOverride?: string
  // Editor integration callbacks
  onPolish?: (polishedContent: string) => void
  onExpand?: (expandedContent: string) => void
  onUnify?: (unifiedContent: string) => void
  // Optional: get current editor content
  getEditorContent?: () => string
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
  const { selectedEvent, setSelectedEvent, loading, error, run, retry } = useAIActions({
    reportId,
    templateId,
    styleOverride,
    onPolish,
    onExpand,
    onUnify,
    getEditorContent,
  })

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
                onClick={retry}
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
            onClick={() => run('polish')}
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
            onClick={() => run('expand')}
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
            onClick={() => run('unify')}
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
