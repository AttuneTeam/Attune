import { github } from "./github";

/**
 * Reference pattern for integration adapter tests.
 *
 * RULE: no test may ever reach a real third-party API. `fetch` is replaced with a
 * spy, and the request itself is asserted — URL, headers, auth — so a change that
 * started calling the network would fail here rather than silently make live
 * requests from CI.
 */

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const errorResponse = (status: number, body = "") =>
  ({ ok: false, status, text: async () => body }) as unknown as Response;

const pr = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: "Fix the thing",
  html_url: "https://github.com/acme/backend/pull/42",
  state: "open",
  created_at: "2026-01-15T00:00:00Z",
  ...overrides,
});

describe("github integration", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // The adapter logs on every call; keep test output readable.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  describe("profileUrl", () => {
    it("builds a github profile link", () => {
      expect(github.profileUrl("octocat")).toBe("https://github.com/octocat");
    });
  });

  describe("request construction", () => {
    it("never calls the real API — fetch is always the spy", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("octocat", {});

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("searches for PRs authored by the handle", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("octocat", {});

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain("https://api.github.com/search/issues");
      expect(url).toContain("is:pr+author:octocat");
    });

    it("url-encodes the handle", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("weird handle", {});

      expect(fetchSpy.mock.calls[0][0]).toContain("author:weird%20handle");
    });

    it("scopes to an org when config.repo has no slash", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("octocat", { repo: "acme" });

      expect(fetchSpy.mock.calls[0][0]).toContain("+org:acme");
    });

    it("scopes to a single repo when config.repo has a slash", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("octocat", { repo: "acme/backend" });

      expect(fetchSpy.mock.calls[0][0]).toContain("+repo:acme/backend");
    });

    it("sends the GitHub API version headers", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("octocat", {});

      const { headers } = fetchSpy.mock.calls[0][1];
      expect(headers.Accept).toBe("application/vnd.github+json");
      expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
    });

    it("authorises with GITHUB_TOKEN when it is set", async () => {
      process.env.GITHUB_TOKEN = "ghp_testtoken";
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("octocat", {});

      expect(fetchSpy.mock.calls[0][1].headers.Authorization).toBe("Bearer ghp_testtoken");
    });

    it("omits the Authorization header entirely when no token is set", async () => {
      delete process.env.GITHUB_TOKEN;
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      await github.fetch("octocat", {});

      expect(fetchSpy.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
    });
  });

  describe("response parsing", () => {
    it("maps a pull request to an ActivityItem", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [pr()] }));

      const [item] = await github.fetch("octocat", {});

      expect(item).toEqual({
        id: "1",
        title: "Fix the thing",
        url: "https://github.com/acme/backend/pull/42",
        status: "open",
        subtitle: "acme/backend",
        date: "2026-01-15T00:00:00Z",
      });
    });

    it("reports merged when the PR has a merged_at", async () => {
      fetchSpy.mockResolvedValue(
        okResponse({
          items: [pr({ state: "closed", pull_request: { merged_at: "2026-01-16T00:00:00Z" } })],
        }),
      );

      const [item] = await github.fetch("octocat", {});

      expect(item.status).toBe("merged");
    });

    it("distinguishes closed from merged", async () => {
      fetchSpy.mockResolvedValue(
        okResponse({ items: [pr({ state: "closed", pull_request: { merged_at: null } })] }),
      );

      const [item] = await github.fetch("octocat", {});

      expect(item.status).toBe("closed");
    });

    it("coerces a numeric id to a string", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [pr({ id: 987654 })] }));

      const [item] = await github.fetch("octocat", {});

      expect(item.id).toBe("987654");
    });

    it("returns an empty array when there are no results", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [] }));

      expect(await github.fetch("octocat", {})).toEqual([]);
    });

    it("tolerates a response with no items key", async () => {
      fetchSpy.mockResolvedValue(okResponse({}));

      expect(await github.fetch("octocat", {})).toEqual([]);
    });

    it("leaves the subtitle blank when html_url is not the expected shape", async () => {
      fetchSpy.mockResolvedValue(okResponse({ items: [pr({ html_url: "https://short" })] }));

      const [item] = await github.fetch("octocat", {});

      expect(item.subtitle).toBe("");
    });
  });

  describe("failure handling", () => {
    it("returns an empty array on an API error rather than throwing", async () => {
      fetchSpy.mockResolvedValue(errorResponse(403, "rate limit exceeded"));

      expect(await github.fetch("octocat", {})).toEqual([]);
    });

    it("returns an empty array on a server error", async () => {
      fetchSpy.mockResolvedValue(errorResponse(500));

      expect(await github.fetch("octocat", {})).toEqual([]);
    });

    it("PROPAGATES a network failure instead of degrading gracefully", async () => {
      // Known gap: an HTTP error status returns [], but a rejected fetch (DNS
      // failure, timeout, offline) propagates to the caller. The two failure
      // modes are handled inconsistently. Pinned so the current behaviour is
      // explicit; see the track index for the follow-up.
      fetchSpy.mockRejectedValue(new Error("network unreachable"));

      await expect(github.fetch("octocat", {})).rejects.toThrow("network unreachable");
    });
  });
});
