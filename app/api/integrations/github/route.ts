import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ActivityItem } from "@/lib/integrations/types";

const GH_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

function getISOWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diff,
    ),
  );
  return d.toISOString().split("T")[0];
}

async function fetchPRs(
  username: string,
  repo: string,
): Promise<ActivityItem[]> {
  let scopeFilter = "";
  if (repo) {
    scopeFilter = repo.includes("/") ? `+repo:${repo}` : `+org:${repo}`;
  }
  const url = `https://api.github.com/search/issues?q=is:pr+author:${encodeURIComponent(username)}${scopeFilter}&sort=created&order=desc&per_page=20`;

  console.log("[github/prs] fetching", {
    username,
    url,
    hasToken: !!process.env.GITHUB_TOKEN,
  });

  const res = await fetch(url, {
    headers: GH_HEADERS,
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[github/prs] failed", { status: res.status, body });
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => {
    const parts = (item.html_url as string).split("/");
    const subtitle = parts.length >= 5 ? `${parts[3]}/${parts[4]}` : "";
    const merged = !!item.pull_request?.merged_at;
    return {
      id: String(item.id),
      title: item.title,
      url: item.html_url,
      status: merged ? "merged" : item.state === "open" ? "open" : "closed",
      subtitle,
      date: item.created_at,
      comments: item.comments ?? 0,
    };
  });
}

async function fetchEvents(
  username: string,
  repo: string,
): Promise<ActivityItem[]> {
  const endpoint = repo
    ? `https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=100`
    : `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`;

  console.log("[github/events] fetching", {
    username,
    endpoint,
    repo,
    hasToken: !!process.env.GITHUB_TOKEN,
  });

  const res = await fetch(endpoint, {
    headers: GH_HEADERS,
    next: { revalidate: 1800 },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[github/events] failed", { status: res.status, body });
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  let events: any[] = await res.json();

  console.log(events);
  if (repo) {
    const isSpecificRepo = repo.includes("/");
    events = events.filter((ev) => {
      const evRepo: string = ev.repo?.name ?? "";
      return isSpecificRepo
        ? evRepo === repo
        : evRepo.startsWith(`${repo}/`);
    });
  }
  const items: ActivityItem[] = [];

  for (const ev of events) {
    const repo: string = ev.repo?.name ?? "";
    const repoUrl = `https://github.com/${repo}`;

    switch (ev.type) {
      case "PushEvent": {
        const count: number = ev.payload?.commits?.length ?? 0;
        items.push({
          id: String(ev.id),
          title: `Pushed ${count} commit${count !== 1 ? "s" : ""}`,
          url: repoUrl,
          status: "push",
          subtitle: repo,
          date: ev.created_at,
        });
        break;
      }
      case "PullRequestEvent": {
        const pr = ev.payload?.pull_request;
        if (!pr) break;
        const merged = ev.payload?.action === "closed" && pr.merged;
        items.push({
          id: String(ev.id),
          title: pr.title,
          url: pr.html_url,
          status: merged ? "merged" : (ev.payload?.action ?? "opened"),
          subtitle: repo,
          date: ev.created_at,
        });
        break;
      }
      case "PullRequestReviewEvent": {
        const pr = ev.payload?.pull_request;
        if (!pr) break;
        items.push({
          id: String(ev.id),
          title: `Reviewed: ${pr.title}`,
          url: pr.html_url,
          status: "review",
          subtitle: repo,
          date: ev.created_at,
        });
        break;
      }
      case "IssuesEvent": {
        const issue = ev.payload?.issue;
        if (!issue) break;
        items.push({
          id: String(ev.id),
          title: issue.title,
          url: issue.html_url,
          status: ev.payload?.action ?? "opened",
          subtitle: repo,
          date: ev.created_at,
        });
        break;
      }
      case "IssueCommentEvent": {
        const issue = ev.payload?.issue;
        if (!issue) break;
        items.push({
          id: String(ev.id),
          title: `Commented on: ${issue.title}`,
          url: ev.payload?.comment?.html_url ?? issue.html_url,
          status: "comment",
          subtitle: repo,
          date: ev.created_at,
        });
        break;
      }
      case "CreateEvent": {
        const refType: string = ev.payload?.ref_type ?? "branch";
        const ref: string = ev.payload?.ref ?? "";
        items.push({
          id: String(ev.id),
          title: `Created ${refType}${ref ? ` "${ref}"` : ""}`,
          url: repoUrl,
          status: "created",
          subtitle: repo,
          date: ev.created_at,
        });
        break;
      }
      case "ReleaseEvent": {
        const release = ev.payload?.release;
        if (!release) break;
        items.push({
          id: String(ev.id),
          title: `Released ${release.tag_name}`,
          url: release.html_url,
          status: "released",
          subtitle: repo,
          date: ev.created_at,
        });
        break;
      }
    }
  }

  return items;
}

async function fetchLastCommit(
  username: string,
  repo: string,
): Promise<ActivityItem | null> {
  if (!repo) return null;

  const repoFilter = repo.includes("/") ? `+repo:${repo}` : `+org:${repo}`;
  const url = `https://api.github.com/search/commits?q=author:${encodeURIComponent(username)}${repoFilter}&sort=committer-date&order=desc&per_page=1`;

  const res = await fetch(url, {
    headers: GH_HEADERS,
    next: { revalidate: 1800 },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[github/lastcommit] failed", { status: res.status, body });
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  return {
    id: item.sha,
    title: item.commit.message.split("\n")[0],
    url: item.html_url,
    status: "commit",
    subtitle: item.repository?.full_name ?? repo,
    date: item.commit.committer.date,
  };
}

async function fetchPRReviewActivity(
  username: string,
  repo: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  managerId: string,
): Promise<{ count: number; history: Array<{ week_start: string; count: number }> }> {
  const weekStart = getISOWeekStart();

  // Use the Search Issues API instead of the Events API.
  // The Events API only returns PUBLIC events for third-party tokens, so any
  // reviews on private repos would be invisible. The Search API respects the
  // token's repo scope and can see private repos the token has access to.
  //
  // reviewed-by: finds PRs where the user submitted a review (approve / request
  // changes / comment). Combining with updated:>=weekStart means the PR was
  // touched this week, which is a reliable proxy because submitting a review
  // always bumps updated_at.
  let scopeFilter = "";
  if (repo) {
    scopeFilter = repo.includes("/") ? `+repo:${repo}` : `+org:${repo}`;
  }
  const url =
    `https://api.github.com/search/issues` +
    `?q=is:pr+reviewed-by:${encodeURIComponent(username)}` +
    `+-author:${encodeURIComponent(username)}` +
    `+updated:>=${weekStart}` +
    `${scopeFilter}` +
    `&per_page=1`;

  let count = 0;
  const res = await fetch(url, {
    headers: GH_HEADERS,
    next: { revalidate: 900 },
  });
  if (res.ok) {
    const data = await res.json();
    count = data.total_count ?? 0;
  } else {
    const body = await res.text();
    console.error("[github/pr_review_comments] search failed", {
      status: res.status,
      body,
    });
  }

  // Upsert this week's count
  const { error: upsertErr } = await supabase
    .from("github_activity_snapshots")
    .upsert(
      {
        manager_id: managerId,
        github_handle: username,
        week_start: weekStart,
        pr_review_comment_count: count,
      },
      { onConflict: "manager_id,github_handle,week_start" },
    );
  if (upsertErr) {
    console.error("[github/pr_review_comments] upsert error", upsertErr);
  }

  // Fetch last 8 weeks of history for sparkline
  const eightWeeksAgo = new Date(weekStart + "T00:00:00Z");
  eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 7 * 7);
  const { data: historyRows, error: historyErr } = await supabase
    .from("github_activity_snapshots")
    .select("week_start, pr_review_comment_count")
    .eq("manager_id", managerId)
    .eq("github_handle", username)
    .gte("week_start", eightWeeksAgo.toISOString().split("T")[0])
    .order("week_start", { ascending: true });
  if (historyErr) {
    console.error("[github/pr_review_comments] history error", historyErr);
  }

  const history = (historyRows ?? []).map((row: any) => ({
    week_start: row.week_start,
    count: row.pr_review_comment_count as number,
  }));

  return { count, history };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "events";
  const username = searchParams.get("username");
  const repo = searchParams.get("repo") ?? "";

  if (!username)
    return NextResponse.json({ error: "username required" }, { status: 400 });

  try {
    if (type === "lastcommit") {
      const item = await fetchLastCommit(username, repo);
      return NextResponse.json({ item });
    }
    if (type === "pr_review_comments") {
      const result = await fetchPRReviewActivity(username, repo, supabase, user.id);
      return NextResponse.json(result);
    }
    const items =
      type === "prs"
        ? await fetchPRs(username, repo)
        : await fetchEvents(username, repo);
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch" },
      { status: 502 },
    );
  }
}
