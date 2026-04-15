"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ExternalLink, GitPullRequest } from "lucide-react";
import type { ActivityItem } from "@/lib/integrations/types";

interface Props {
  handle: string;
  repo?: string;
}

export function GitHubSummaryTile({ handle, repo }: Props) {
  const [prs, setPrs] = useState<ActivityItem[] | null>(null);
  const [lastCommit, setLastCommit] = useState<ActivityItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prParams = new URLSearchParams({ type: "prs", username: handle });
    if (repo) prParams.set("repo", repo);
    const lcParams = new URLSearchParams({
      type: "lastcommit",
      username: handle,
    });
    if (repo) lcParams.set("repo", repo);

    Promise.all([
      fetch(`/api/integrations/github?${prParams}`).then((r) =>
        r.ok ? r.json() : null,
      ),
      repo
        ? fetch(`/api/integrations/github?${lcParams}`).then((r) =>
            r.ok ? r.json() : null,
          )
        : Promise.resolve(null),
    ])
      .then(([prData, lcData]) => {
        setPrs(prData?.items ?? []);
        setLastCommit(lcData?.item ?? null);
      })
      .catch(() => setPrs([]))
      .finally(() => setLoading(false));
  }, [handle, repo]);

  const lastActivity = lastCommit ?? prs?.[0] ?? null;
  const openPR = prs?.find((p) => p.status === "open") ?? null;
  const closedPR =
    prs?.find((p) => p.status === "closed" || p.status === "merged") ?? null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="h-3.5 w-3.5 text-muted-foreground shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          GitHub
        </span>
        <a
          href={`https://github.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          @{handle}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {loading ? (
        <div className="flex gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 h-10 bg-muted rounded" />
          ))}
        </div>
      ) : !prs || prs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No recent pull request activity.
        </p>
      ) : (
        <div className="gap-4">
          {/* Last commit */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Last commit
            </p>
            {lastActivity ? (
              <>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(parseISO(lastActivity.date), {
                    addSuffix: true,
                  })}
                </p>
                {lastActivity.subtitle && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {lastActivity.subtitle}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>

          {/* Most recently opened PR */}
          <div className="mt-2 space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <GitPullRequest className="h-3 w-3" /> Open PR
            </p>
            {openPR ? (
              <a
                href={openPR.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium hover:underline underline-offset-2 line-clamp-2 leading-snug block"
              >
                {openPR.title}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">None open</p>
            )}
          </div>

          {/* Most recently closed PR */}
          {/* <div className="pl-4 space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <GitPullRequest className="h-3 w-3" />
              {closedPR?.status === "merged" ? "Merged PR" : "Closed PR"}
            </p>
            {closedPR ? (
              <a
                href={closedPR.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium hover:underline underline-offset-2 line-clamp-2 leading-snug block"
              >
                {closedPR.title}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">None found</p>
            )}
          </div> */}
        </div>
      )}
    </div>
  );
}
