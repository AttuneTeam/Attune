"use client";

import { useRouter } from "next/navigation";

export function StatusFilterSelect({ value }: { value?: string }) {
  const router = useRouter();
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/action-items?status=${v}` : "/action-items");
      }}
      className="h-8 rounded-md border bg-background px-2 py-0 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="">All</option>
      <option value="open">Open</option>
      <option value="in_progress">In progress</option>
      <option value="done">Done</option>
    </select>
  );
}
