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
    };
  });
}

async function fetchEvents(
  username: string,
  repo: string,
): Promise<ActivityItem[]> {
  // When a repo is supplied use the authenticated endpoint so private events are included.
  // The token must have `repo` scope for private repo events to be visible.
  // Without a repo filter, fall back to the public endpoint to avoid leaking unrelated private activity.
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
  // Filter to the specified repo/org when supplied
  if (repo) {
    const isSpecificRepo = repo.includes("/");
    events = events.filter((ev) => {
      const evRepo: string = ev.repo?.name ?? "";
      return isSpecificRepo
        ? evRepo === repo // exact "owner/repo" match
        : evRepo.startsWith(`${repo}/`); // any repo in the org
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
