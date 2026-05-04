'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { FormattingBubbleMenu } from '@/components/editor/FormattingBubbleMenu'

interface Props {
  initialValue: string
  onChange: (markdown: string) => void
  placeholder?: string
}

export function DescriptionEditor({ initialValue, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? 'Add notes, context, links…',
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: initialValue,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((editor.storage as any).markdown.getMarkdown() as string)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-neutral dark:prose-invert max-w-none focus:outline-none px-3 py-2 min-h-[80px]',
      },
    },
  })

  return (
    <div className="rounded-md border border-input bg-background overflow-hidden focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
      <FormattingBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
