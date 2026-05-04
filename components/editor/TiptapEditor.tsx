"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Markdown } from "tiptap-markdown";
import { FormattingBubbleMenu } from "./FormattingBubbleMenu";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/lib/supabase/types";

interface Props {
  interactionId: string;
  initialContent: Json | null;
  onStatsChange?: (stats: { wordCount: number; saving: boolean }) => void;
}

export function TiptapEditor({ interactionId, initialContent, onStatsChange }: Props) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (json: unknown) => {
      setSaving(true);
      const supabase = createClient();
      const { error } = await supabase
        .from("interactions")
        .update({ raw_json_notes: json as Json })
        .eq("id", interactionId);
      setSaving(false);
      if (error) {
        toast.error("Failed to save notes");
      }
    },
    [interactionId],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          "Start taking notes… Use # for headings, ** for bold, - for lists.",
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
      onStatsChange?.({
        wordCount: editor.storage.characterCount?.words() ?? 0,
        saving: true,
      });
    },
    editorProps: {
      attributes: {
        class:
          "prose-editor prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[400px]",
      },
    },
  });

  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  useEffect(() => {
    onStatsChange?.({ wordCount, saving });
  }, [wordCount, saving, onStatsChange]);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  return (
    <div className="flex flex-col flex-1">
      <FormattingBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}
