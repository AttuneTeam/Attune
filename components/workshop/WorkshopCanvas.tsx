"use client";

import { useState } from "react";
import { PERSONAS } from "@/lib/ai/personas";
import type { PersonaId } from "@/lib/ai/personas";
import type { WorkshopSession } from "@/lib/supabase/types";
import { PersonaChip } from "./PersonaChip";
import { WorkshopSkeleton } from "./WorkshopSkeleton";
import { PersonaAnalysisCard } from "./PersonaAnalysisCard";
import { SynthesisPanel } from "./SynthesisPanel";
import { WorkshopHistory } from "./WorkshopHistory";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const WORKSHOP_PERSONAS = PERSONAS.filter((p) => p.id !== "default");
const ALL_PERSONA_IDS = WORKSHOP_PERSONAS.map((p) => p.id as PersonaId);

type Status = "idle" | "loading" | "done" | "error";

export function WorkshopCanvas({
  userId,
  initialSessions,
}: {
  userId: string;
  initialSessions: WorkshopSession[];
}) {
  const [sessions, setSessions] = useState<WorkshopSession[]>(initialSessions);
  const [activeSession, setActiveSession] = useState<WorkshopSession | null>(
    initialSessions[0] ?? null,
  );
  const [isNew, setIsNew] = useState(initialSessions.length === 0);

  const [question, setQuestion] = useState("");
  const [selectedPersonas, setSelectedPersonas] =
    useState<PersonaId[]>(ALL_PERSONA_IDS);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function togglePersona(id: PersonaId) {
    setSelectedPersonas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function openNew() {
    setIsNew(true);
    setActiveSession(null);
    setStatus("idle");
    setQuestion("");
    setErrorMsg(null);
  }

  function loadSession(session: WorkshopSession) {
    setActiveSession(session);
    setIsNew(false);
    setStatus("done");
  }

  async function handleRun() {
    if (!question.trim() || selectedPersonas.length === 0) return;
    setStatus("loading");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), personaIds: selectedPersonas }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }

      const { session } = await res.json();
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setIsNew(false);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to run workshop");
      setStatus("error");
    }
  }

  const canRun =
    status !== "loading" &&
    question.trim().length >= 10 &&
    selectedPersonas.length > 0;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* History panel */}
      <aside className="w-64 shrink-0 border-r border-border overflow-y-auto flex flex-col">
        <div className="p-3 border-b border-border">
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            New workshop
          </button>
        </div>
        <WorkshopHistory
          sessions={sessions}
          activeId={activeSession?.id ?? null}
          onSelect={loadSession}
        />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          {isNew || status === "idle" || status === "loading" || status === "error" ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold mb-1">Workshop</h1>
                <p className="text-sm text-muted-foreground">
                  Ask a complex management question and get structured analysis from multiple perspectives.
                </p>
              </div>

              <div className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. I need to scale from 10 to 35+ engineers — what issues may occur and how should I prepare?"
                  rows={4}
                  disabled={status === "loading"}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition"
                />

                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-muted-foreground shrink-0">Perspectives:</span>
                  {WORKSHOP_PERSONAS.map((persona) => (
                    <PersonaChip
                      key={persona.id}
                      persona={persona}
                      selected={selectedPersonas.includes(persona.id as PersonaId)}
                      onToggle={() => togglePersona(persona.id as PersonaId)}
                      disabled={status === "loading"}
                    />
                  ))}
                </div>

                <Button onClick={handleRun} disabled={!canRun}>
                  {status === "loading" ? "Running…" : "Run Workshop"}
                </Button>
              </div>

              {status === "error" && errorMsg && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {errorMsg}
                  <button
                    type="button"
                    onClick={handleRun}
                    className="ml-3 underline underline-offset-2 hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {status === "loading" && (
                <WorkshopSkeleton count={selectedPersonas.length} />
              )}
            </div>
          ) : activeSession ? (
            <div className="space-y-6 animate-in fade-in-0 duration-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold leading-snug">{activeSession.question}</h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeSession.persona_ids.length} perspective{activeSession.persona_ids.length !== 1 ? "s" : ""}
                    {" · "}
                    {new Date(activeSession.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={openNew}>
                  New
                </Button>
              </div>

              <SynthesisPanel synthesis={activeSession.synthesis} userId={userId} />

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                  Perspectives
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSession.persona_analyses.map((analysis) => (
                    <PersonaAnalysisCard key={analysis.persona_id} analysis={analysis} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
