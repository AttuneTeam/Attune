'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { FormattingBubbleMenu } from '@/components/editor/FormattingBubbleMenu'
import type { Json } from '@/lib/supabase/types'

interface Props {
  initialContent?: Json | null
  onChange: (json: Json) => void
  placeholder?: string
}

export function RichTextInput({ initialContent, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Add a description…',
      }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content: initialContent as object ?? undefined,
    onUpdate({ editor }) {
      onChange(editor.getJSON() as Json)
    },
  })

  return (
    <div className="rounded-md border bg-background min-h-[100px] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring">
      <FormattingBubbleMenu editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none focus:outline-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  )
}
