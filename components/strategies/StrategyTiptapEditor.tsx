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
import { cn } from "@/lib/utils";

/** Full-page defaults. The drawer on /map overrides both — see AreaDetailSheet. */
const DEFAULT_CONTENT_CLASS = "min-h-[400px] px-8 py-6";
const DEFAULT_FOOTER_CLASS = "px-8 py-2 border-t";

interface Props {
  initiativeId: string;
  initialContent: Json | null;
  /** Called only after the database confirms a description write. */
  onSaved?: (description: Json) => void;
  /**
   * Padding and minimum height for the editable area. Defaulted so the
   * full-page initiative editor is unchanged; the map's drawer passes something
   * far tighter, where 32px of gutter would leave almost no line length.
   */
  contentClassName?: string;
  /** The word-count footer, for the same reason. */
  footerClassName?: string;
}

export function StrategyTiptapEditor({
  initiativeId,
  initialContent,
  onSaved,
  contentClassName = DEFAULT_CONTENT_CLASS,
  footerClassName = DEFAULT_FOOTER_CLASS,
}: Props) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSaving = useRef(false);
  const queuedJson = useRef<unknown>(undefined);
  const hasQueuedJson = useRef(false);
  const latestJson = useRef<unknown>(undefined);

  const save = useCallback(
    async (json: unknown) => {
      // A second debounce can expire while the first request is still in
      // flight. Keeping the latest document means fast typing never loses its
      // final edit merely because an earlier save was slow.
      if (isSaving.current) {
        queuedJson.current = json;
        hasQueuedJson.current = true;
        return;
      }
      isSaving.current = true;
      let next: unknown = json;

      do {
        hasQueuedJson.current = false;
        const supabase = createClient();
        const { data, error } = await supabase
          .from("strategic_initiatives")
          .update({
            description: next as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initiativeId)
          // RLS can turn an unauthorized update into an empty successful
          // response. Requesting the id lets the UI report that honestly
          // instead of claiming the note was auto-saved.
          .select("id");
        if (error || !data || data.length === 0) {
          toast.error("Failed to save");
        } else {
          onSaved?.(next as Json);
        }
        next = queuedJson.current;
      } while (hasQueuedJson.current);

      isSaving.current = false;
    },
    [initiativeId, onSaved],
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
      const json = editor.getJSON();
      latestJson.current = json;
      saveTimeout.current = setTimeout(() => {
        saveTimeout.current = null;
        void save(json);
      }, 1500);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none",
          contentClassName,
        ),
      },
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      // Closing the sheet unmounts the editor. Flush its last change rather
      // than clearing the debounce and discarding what the manager just wrote.
      if (latestJson.current !== undefined) void save(latestJson.current);
    };
  }, [save]);

  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  return (
    <div className="flex flex-col flex-1">
      <FormattingBubbleMenu editor={editor} />
      <EditorContent editor={editor} className="flex-1" />
      <div className={cn("text-xs text-muted-foreground flex gap-4", footerClassName)}>
        <span>{wordCount} words</span>
        <span className="ml-auto opacity-50">Auto-saved</span>
      </div>
    </div>
  );
}
