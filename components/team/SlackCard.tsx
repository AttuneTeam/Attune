"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Zap, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { IntegrationResult } from "@/lib/integrations/types";

type DmMessage = {
  ts: string;
  user: string;
  text: string;
  isFromMember: boolean;
};

export function SlackCard({ result }: { result: IntegrationResult }) {
  const [messages, setMessages] = useState<DmMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function loadDMs() {
    if (messages !== null) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/integrations/slack/dm?member_id=${encodeURIComponent(result.handle)}`,
      );
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      setFetchError("Failed to load messages.");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{result.label}</h2>
        {result.profileUrl && (
          <a
            href={result.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto flex items-center gap-1"
          >
            @{result.handle}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Items (status + activity) */}
      {result.error ? (
        <p className="text-xs text-destructive">{result.error}</p>
      ) : result.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No recent activity found.
        </p>
      ) : (
        <ul className="space-y-2">
          {result.items.slice(0, 10).map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              <Badge
                variant={
                  item.status === "merged" ||
                  item.status === "published" ||
                  item.status === "done"
                    ? "secondary"
                    : item.status === "open"
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5 capitalize"
              >
                {item.status}
              </Badge>
              <div className="flex-1 min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground hover:underline underline-offset-2 line-clamp-1"
                >
                  {item.title}
                </a>
                <p className="text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* DMs button */}
      <div className="mt-3 pt-3 border-t border-dashed">
        <Dialog onOpenChange={(open) => open && loadDMs()}>
          <DialogTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              />
            }
          >
            <MessageSquare className="h-3 w-3" />
            Recent DMs
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Recent DMs — {result.handle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-1">
              {loading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Loading…
                </p>
              )}
              {fetchError && (
                <p className="text-xs text-destructive">{fetchError}</p>
              )}
              {!loading && messages !== null && messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No recent messages found.
                </p>
              )}
              {!loading &&
                messages?.map((msg) => (
                  <div key={msg.ts} className="flex gap-2.5 text-xs">
                    <span
                      className={
                        msg.isFromMember
                          ? "font-medium text-foreground shrink-0"
                          : "font-medium text-muted-foreground shrink-0"
                      }
                    >
                      {msg.isFromMember ? "Them" : "You"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground leading-relaxed break-words">
                        {msg.text || (
                          <span className="italic text-muted-foreground">
                            (attachment)
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        {format(
                          new Date(parseFloat(msg.ts) * 1000),
                          "MMM d, h:mm a",
                        )}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
