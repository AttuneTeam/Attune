'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Markdown } from 'tiptap-markdown'
import { FloatingAIMenu } from './FloatingAIMenu'
import { FormattingBubbleMenu } from './FormattingBubbleMenu'
import { useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Json } from '@/lib/supabase/types'

interface Props {
  interactionId: string
  initialContent: Json | null
  onSummaryUpdate?: (summary: string, sentiment: number, themes: string[]) => void
  onActionItemsUpdate?: () => void
}

export function TiptapEditor({ interactionId, initialContent, onSummaryUpdate, onActionItemsUpdate }: Props) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSaving = useRef(false)

  const save = useCallback(async (json: unknown) => {
    if (isSaving.current) return
    isSaving.current = true
    const supabase = createClient()
    const { error } = await supabase
      .from('interactions')
      .update({ raw_json_notes: json as Json })
      .eq('id', interactionId)
    isSaving.current = false
    if (error) {
      toast.error('Failed to save notes')
    }
  }, [interactionId])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start taking notes… Use # for headings, ** for bold, - for lists.',
      }),
      CharacterCount,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: initialContent ? JSON.parse(JSON.stringify(initialContent)) : '',
    onUpdate: ({ editor }) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        save(editor.getJSON())
      }, 1500)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-6',
      },
    },
  })

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  const wordCount = editor?.storage.characterCount?.words() ?? 0

  return (
    <div className="flex flex-col flex-1">
      <FormattingBubbleMenu editor={editor} />
      <FloatingAIMenu
        editor={editor}
        interactionId={interactionId}
        onSummaryUpdate={onSummaryUpdate}
        onActionItemsUpdate={onActionItemsUpdate}
      />
      <EditorContent editor={editor} className="flex-1" />
      <div className="px-8 py-2 border-t text-xs text-muted-foreground flex gap-4">
        <span>{wordCount} words</span>
        <span className="ml-auto opacity-50">Auto-saved</span>
      </div>
    </div>
  )
}
