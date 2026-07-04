'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StyleSelector } from './StyleSelector'
import { AIAssistantPanel } from './AIAssistantPanel'
import { SnippetLibraryPanel } from './SnippetLibraryPanel'
import { Sparkles, BookOpen } from 'lucide-react'
import type { AIStyle } from '@/lib/db/schema'

interface EditorSidebarProps {
  reportId: number
  templateId?: number
  onStyleChange?: (style: AIStyle) => void
  onSelectSnippet?: (snippet: string) => void
  // AI operation callbacks
  onPolish?: (polishedContent: string) => void
  onExpand?: (expandedContent: string) => void
  onUnify?: (unifiedContent: string) => void
  getEditorContent?: () => string
}

export function EditorSidebar({
  reportId,
  templateId,
  onStyleChange,
  onSelectSnippet,
  onPolish,
  onExpand,
  onUnify,
  getEditorContent,
}: EditorSidebarProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'snippets'>('ai')
  const [styleOverride, setStyleOverride] = useState<AIStyle | undefined>()

  const handleStyleChange = (style: AIStyle) => {
    setStyleOverride(style)
    onStyleChange?.(style)
  }

  return (
    <div className="h-full flex flex-col bg-background border-l border-border">
      {/* Header with Style Selector */}
      <div className="p-4 border-b border-border space-y-4">
        <h2 className="text-lg font-semibold text-foreground">编辑助手</h2>
        <StyleSelector
          value={styleOverride}
          onChange={handleStyleChange}
          templateId={templateId}
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'ai' | 'snippets')}
        className="flex-1 flex flex-col"
      >
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="ai" className="flex-1 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI 助手</span>
            </TabsTrigger>
            <TabsTrigger value="snippets" className="flex-1 gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              <span>片段库</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="ai" className="p-4 m-0">
            <AIAssistantPanel
              reportId={reportId}
              templateId={templateId}
              styleOverride={styleOverride}
              onPolish={onPolish}
              onExpand={onExpand}
              onUnify={onUnify}
              getEditorContent={getEditorContent}
            />
          </TabsContent>

          <TabsContent value="snippets" className="p-4 m-0">
            <SnippetLibraryPanel onSelectSnippet={onSelectSnippet} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}