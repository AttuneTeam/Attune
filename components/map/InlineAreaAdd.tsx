"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createArea } from "@/lib/map/api";
import { cn } from "@/lib/utils";

/**
 * Keyboard-first capture. Type a title, press Enter, keep typing.
 *
 * Zero-friction capture is a product principle, not a nicety: a manager
 * emptying their head onto the map will add a dozen areas in a row, and a
 * dialog or a Save button between each one would stop them doing it at all.
 * So the input stays where it is and stays focused, and the page revalidates
 * behind it.
 *
 * On failure the typed text is deliberately left in place. Losing what someone
 * just wrote to show them an error is the one thing product-guidelines.md UX
 * principle 7 rules out.
 */
export function InlineAreaAdd({
  domainId,
  domainName,
  parentId,
  placeholder = "Add an area",
  className,
}: {
  /** Undefined leaves the domain unset; null explicitly means ungrouped. */
  domainId?: string | null;
  /** Only for the accessible label — the write uses the id. */
  domainName?: string | null;
  parentId?: string;
  placeholder?: string;
  className?: string;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    const result = await createArea({
      title: trimmed,
      ...(domainId !== undefined ? { domain_id: domainId } : {}),
      ...(parentId !== undefined ? { parent_id: parentId } : {}),
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      // The text stays. Re-focusing puts the cursor back where they were.
      inputRef.current?.focus();
      return;
    }

    setTitle("");
    inputRef.current?.focus();
    router.refresh();
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={title}
      disabled={saving}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
        if (e.key === "Escape") setTitle("");
      }}
      placeholder={placeholder}
      aria-label={
        parentId
          ? "Add an area beneath this one"
          : `Add an area to ${domainName ?? "the map"}`
      }
      className={cn(
        // No border: a boxed field here would cut the row list in two. The
        // focus state is a surface shift instead.
        "min-h-11 w-full rounded-md bg-transparent px-3 text-sm",
        "placeholder:text-muted-foreground/70",
        "focus:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        "disabled:opacity-50",
        className,
      )}
    />
  );
}
