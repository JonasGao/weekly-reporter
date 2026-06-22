'use client'

import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'

interface MilkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function MilkdownEditorInner({ value, onChange, placeholder = '开始编写周报...' }: MilkdownEditorProps) {
  useEditor((root) =>
    Editor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, value || placeholder)
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          onChange(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
  )

  return <Milkdown />
}

export function MilkdownEditor({ value, onChange, placeholder }: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <div className="min-h-[400px] border rounded-md p-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <MilkdownEditorInner value={value} onChange={onChange} placeholder={placeholder} />
      </div>
    </MilkdownProvider>
  )
}