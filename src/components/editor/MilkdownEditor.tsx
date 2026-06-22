'use client'

import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import '@milkdown/theme-nord/style.css'

interface MilkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function MilkdownEditorInner({ value, onChange, placeholder = '开始编写周报...' }: MilkdownEditorProps) {
  const { get } = useEditor((root) =>
    Editor.make()
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