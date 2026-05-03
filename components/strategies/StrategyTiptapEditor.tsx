"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Markdown } from "tiptap-markdown";
import { FormattingBubbleMenu } from "@/components/editor/FormattingBubbleMenu";
import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/lib/supabase/types";

interface Props {
  initiativeId: string;
  initialContent: Json | null;
}

export function StrategyTiptapEditor({ initiativeId, initialContent }: Props) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSaving = useRef(false);

  const save = useCallback(
    async (json: unknown) => {
      if (isSaving.current) return;
      isSaving.current = true;
      const supabase = createClient();
      const { error } = await supabase
        .from("strategic_initiatives")
        .update({
          description: json as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", initiativeId);
      isSaving.current = false;
      if (error) toast.error("Failed to save");
    },
    [initiativeId],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Placeholder.configure({
        placeholder:
          "Write your initiative here… Use # for headings, ** for bold, - for lists.",
      }),
      CharacterCount,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: false,
      }),
    ],
    content: initialContent ? JSON.parse(JSON.stringify(initialContent)) : "",
    onUpdate: ({ editor }) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        save(editor.getJSON());
      }, 1500);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-6",
      },
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className="flex flex-col flex-1">
      <FormattingBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="flex-1" />
      <div className="px-8 py-2 border-t text-xs text-muted-foreground flex gap-4">
        <span>{wordCount} words</span>
        <span className="ml-auto opacity-50">Auto-saved</span>
      </div>
    </div>
  );
}
