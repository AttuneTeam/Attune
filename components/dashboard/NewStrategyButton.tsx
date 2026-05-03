"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

export function NewStrategyButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleClick = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/initiatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed");
      const { id } = await res.json();
      router.push(`/initiatives/${id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={creating}>
      <Target className="h-3.5 w-3.5 mr-1.5" />
      {creating ? "Creating…" : "New initiative"}
    </Button>
  );
}
