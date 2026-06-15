"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, Shield, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { SignalType, StrategicInitiative, InteractionInitiativeSignal } from "@/lib/supabase/types";

const SIGNAL_OPTIONS: {
  value: SignalType;
  label: string;
  icon: React.ElementType;
  className: string;
}[] = [
  { value: "advances", label: "Advances", icon: TrendingUp, className: "text-blue-500" },
  { value: "reinforces", label: "Reinforces", icon: Shield, className: "text-green-500" },
  { value: "threatens", label: "Threatens", icon: AlertTriangle, className: "text-destructive" },
];

type SignalWithInitiative = InteractionInitiativeSignal & {
  strategic_initiatives: Pick<StrategicInitiative, "id" | "title"> | null;
};

interface Props {
  interactionId: string;
}

export function InitiativeSignalsPanel({ interactionId }: Props) {
  const [signals, setSignals] = useState<SignalWithInitiative[]>([]);
  const [allInitiatives, setAllInitiatives] = useState<Pick<StrategicInitiative, "id" | "title">[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState("");
  const [selectedSignal, setSelectedSignal] = useState<SignalType>("advances");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("interaction_initiative_signals")
      .select("*, strategic_initiatives ( id, title )")
      .eq("interaction_id", interactionId)
      .order("created_at");
    setSignals((data as SignalWithInitiative[]) ?? []);
  }, [interactionId]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const openAdd = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("strategic_initiatives")
      .select("id, title")
      .eq("status", "active")
      .order("title");
    setAllInitiatives(data ?? []);
    setSelectedInitiativeId(data?.[0]?.id ?? "");
    setSelectedSignal("advances");
    setNote("");
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (!selectedInitiativeId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/initiatives/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionId,
          initiativeId: selectedInitiativeId,
          signal: selectedSignal,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAddOpen(false);
      await fetchSignals();
    } catch {
      toast.error("Failed to link initiative");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (signal: SignalWithInitiative) => {
    setDeletingId(signal.id);
    try {
      const res = await fetch("/api/initiatives/signals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interactionId,
          initiativeId: signal.initiative_id,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchSignals();
    } catch {
      toast.error("Failed to remove signal");
    } finally {
      setDeletingId(null);
    }
  };

  const SignalIcon = ({ type }: { type: SignalType }) => {
    const opt = SIGNAL_OPTIONS.find((o) => o.value === type)!;
    const Icon = opt.icon;
    return <Icon className={`h-3.5 w-3.5 shrink-0 ${opt.className}`} />;
  };

  return (
    <div className="flex flex-col">
      {signals.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No linked initiatives yet.
        </p>
      ) : (
        <div className="p-3 space-y-1">
          {signals.map((s) => (
            <div
              key={s.id}
              className="group flex items-start gap-2 p-2 rounded-md hover:bg-accent/30 transition-colors"
            >
              <SignalIcon type={s.signal} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium leading-snug truncate">
                  {s.strategic_initiatives?.title ?? "Unknown initiative"}
                </p>
                {s.note && (
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                    {s.note}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(s)}
                disabled={deletingId === s.id}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-70 shrink-0"
                title="Remove link"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={openAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          Link initiative
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Link to initiative</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Initiative</label>
              {allInitiatives.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active initiatives found.</p>
              ) : (
                <select
                  value={selectedInitiativeId}
                  onChange={(e) => setSelectedInitiativeId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {allInitiatives.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Signal</label>
              <div className="flex gap-2">
                {SIGNAL_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = selectedSignal === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedSignal(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md border text-xs font-medium transition-colors ${
                        active
                          ? "border-foreground bg-accent"
                          : "border-input hover:bg-accent/50"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${opt.className}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Note <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why does this conversation matter to the initiative?"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedInitiativeId}
            >
              {saving ? "Saving…" : "Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
