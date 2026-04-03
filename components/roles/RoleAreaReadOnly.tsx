'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import type { RoleArea } from '@/lib/supabase/types'

export function RoleAreaReadOnly({ area }: { area: RoleArea }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content: (area.description as object) ?? undefined,
  })

  return (
    <div className="rounded-lg border bg-card p-5 space-y-2">
      <p className="text-sm font-semibold">{area.title || 'Untitled area'}</p>
      {area.description && editor && (
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_.tiptap]:outline-none"
        />
      )}
    </div>
  )
}
