"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ExternalLink, GitPullRequest, MessageSquare } from "lucide-react";
import type { ActivityItem } from "@/lib/integrations/types";

interface Props {
  handle: string;
  repo?: string;
}

interface ReviewActivity {
  count: number;
  history: Array<{ week_start: string; count: number }>;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const BAR_W = 6;
  const GAP = 2;
  const H = 18;
  const W = data.length * (BAR_W + GAP) - GAP;

  return (
    <svg
      width={W}
      height={H}
      className="inline-block align-middle shrink-0"
      aria-hidden
    >
      {data.map((v, i) => {
        const barH = Math.max(2, Math.round((v / max) * H));
        return (
          <rect
            key={i}
            x={i * (BAR_W + GAP)}
            y={H - barH}
            width={BAR_W}
            height={barH}
            rx={1}
            className="fill-primary/40"
          />
        );
      })}
    </svg>
  );
}

export function GitHubSummaryTile({ handle, repo }: Props) {
  const [prs, setPrs] = useState<ActivityItem[] | null>(null);
  const [lastCommit, setLastCommit] = useState<ActivityItem | null>(null);
  const [reviewActivity, setReviewActivity] = useState<ReviewActivity | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prParams = new URLSearchParams({ type: "prs", username: handle });
    if (repo) prParams.set("repo", repo);
    const lcParams = new URLSearchParams({
      type: "lastcommit",
      username: handle,
    });
    if (repo) lcParams.set("repo", repo);
    const reviewParams = new URLSearchParams({
      type: "pr_review_comments",
      username: handle,
    });
    if (repo) reviewParams.set("repo", repo);

    Promise.all([
      fetch(`/api/integrations/github?${prParams}`).then((r) =>
        r.ok ? r.json() : null,
      ),
      repo
        ? fetch(`/api/integrations/github?${lcParams}`).then((r) =>
            r.ok ? r.json() : null,
          )
        : Promise.resolve(null),
      fetch(`/api/integrations/github?${reviewParams}`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([prData, lcData, reviewData]) => {
        setPrs(prData?.items ?? []);
        setLastCommit(lcData?.item ?? null);
        setReviewActivity(reviewData ?? null);
      })
      .catch(() => setPrs([]))
      .finally(() => setLoading(false));
  }, [handle, repo]);

  const lastActivity = lastCommit ?? prs?.[0] ?? null;
  const openPRs = prs?.filter((p) => p.status === "open") ?? [];

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
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
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

          {/* Open PRs */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <GitPullRequest className="h-3 w-3" />
              Open PRs
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0 text-[10px] font-semibold text-foreground min-w-[16px]">
                {openPRs.length}
              </span>
            </p>
            {openPRs.length === 0 ? (
              <p className="text-xs text-muted-foreground">None open</p>
            ) : (
              <ul className="space-y-1.5">
                {openPRs.slice(0, 4).map((pr) => (
                  <li key={pr.id} className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:underline underline-offset-2 line-clamp-1 leading-snug block"
                      >
                        {pr.title}
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">
                          {pr.subtitle}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(parseISO(pr.date), {
                            addSuffix: false,
                          })}
                        </span>
                        {(pr.comments ?? 0) > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                            <MessageSquare className="h-2.5 w-2.5" />
                            {pr.comments}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
                {openPRs.length > 4 && (
                  <li className="text-[10px] text-muted-foreground">
                    +{openPRs.length - 4} more
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* PR review activity this week */}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              PRs reviewed this week
            </p>
            {reviewActivity === null ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {reviewActivity.count}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  PR{reviewActivity.count !== 1 ? "s" : ""}
                </span>
                {reviewActivity.history.length >= 2 && (
                  <Sparkline
                    data={reviewActivity.history.map((h) => h.count)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
