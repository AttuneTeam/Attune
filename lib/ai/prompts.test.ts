import { extractPlainText, formatOrgContext, formatTeamValues } from "./prompts";

describe("extractPlainText", () => {
  /**
   * This feeds every AI prompt and the embeddings pipeline: notes are stored as
   * Tiptap JSON and must be flattened before reaching the model. Mangled output
   * here degrades summaries, action-item extraction and semantic search alike.
   */

  it("joins inline fragments within a paragraph without inserting breaks", () => {
    // A sentence containing bold/italic/code is stored as several text nodes.
    // Flattening must reassemble the sentence, not split it.
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Sam is " },
            { type: "text", text: "blocked", marks: [{ type: "bold" }] },
            { type: "text", text: " on review." },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("Sam is blocked on review.");
  });

  it("separates sibling paragraphs with a newline", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First." }] },
        { type: "paragraph", content: [{ type: "text", text: "Second." }] },
      ],
    };

    expect(extractPlainText(doc)).toBe("First.\nSecond.");
  });

  it("separates a heading from the paragraph beneath it", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Growth" }] },
        { type: "paragraph", content: [{ type: "text", text: "Wants more scope." }] },
      ],
    };

    expect(extractPlainText(doc)).toBe("Growth\nWants more scope.");
  });

  it("puts each list item on its own line", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "alpha" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "beta" }] }] },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("alpha\nbeta");
  });

  it("turns a hard break into a newline rather than merging the words", () => {
    // Shift+Enter in the editor produces a hardBreak: a leaf node with neither
    // text nor content. Paragraphs join their children with "", so a hardBreak
    // that yields "" silently concatenates the words either side of it.
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("Line one\nLine two");
  });

  it("keeps words apart when a hard break sits next to formatted text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "blocked", marks: [{ type: "bold" }] },
            { type: "hardBreak" },
            { type: "text", text: "since Tuesday" },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("blocked\nsince Tuesday");
  });

  it("handles deeply nested structures", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "quoted " },
                { type: "text", text: "words", marks: [{ type: "italic" }] },
              ],
            },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).toBe("quoted words");
  });

  describe("malformed input", () => {
    it("returns an empty string for null and undefined", () => {
      expect(extractPlainText(null)).toBe("");
      expect(extractPlainText(undefined)).toBe("");
    });

    it("returns an empty string for non-objects", () => {
      expect(extractPlainText("a string")).toBe("");
      expect(extractPlainText(42)).toBe("");
    });

    it("returns an empty string for a doc with no content", () => {
      expect(extractPlainText({ type: "doc" })).toBe("");
      expect(extractPlainText({ type: "doc", content: [] })).toBe("");
    });

    it("skips nodes missing their text and does not throw", () => {
      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text" }, { type: "text", text: "kept" }] },
        ],
      };

      expect(() => extractPlainText(doc)).not.toThrow();
      expect(extractPlainText(doc)).toBe("kept");
    });

    it("trims surrounding whitespace", () => {
      const doc = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "  padded  " }] }],
      };

      expect(extractPlainText(doc)).toBe("padded");
    });
  });
});

describe("formatTeamValues", () => {
  it("returns null for an empty list so the prompt omits the section entirely", () => {
    expect(formatTeamValues([])).toBeNull();
  });

  it("includes name, description and keywords", () => {
    const out = formatTeamValues([
      { name: "Ownership", description: "DRIs decide.", keywords: ["autonomy", "DRI"] },
    ]);

    expect(out).toContain("Team values");
    expect(out).toContain("- Ownership");
    expect(out).toContain("DRIs decide.");
    expect(out).toContain("Keywords: autonomy; DRI");
  });

  it("omits the description line when there is none", () => {
    const out = formatTeamValues([{ name: "Candour", description: null, keywords: [] }]);

    expect(out).toContain("- Candour");
    expect(out).not.toContain("Keywords:");
    expect(out).not.toContain("null");
  });

  it("separates multiple values", () => {
    const out = formatTeamValues([
      { name: "One", description: null, keywords: [] },
      { name: "Two", description: null, keywords: [] },
    ]);

    expect(out).toContain("- One");
    expect(out).toContain("- Two");
  });
});

describe("formatOrgContext", () => {
  it("returns null when there is no context at all", () => {
    expect(formatOrgContext(null)).toBeNull();
  });

  it("returns null when every field is empty, rather than an empty header", () => {
    // A bare "Organisational context:" header with nothing under it would waste
    // tokens and read as a bug in the prompt.
    expect(formatOrgContext({})).toBeNull();
  });

  it("emits only the sections that have data", () => {
    const out = formatOrgContext({ company_name: "Acme", industry: "SaaS" });

    expect(out).toContain("Company context:");
    expect(out).toContain("Company: Acme");
    expect(out).toContain("Industry: SaaS");
    expect(out).not.toContain("Team context:");
    expect(out).not.toContain("Ways of working:");
    expect(out).not.toContain("Culture:");
  });

  it("groups fields under their correct headings", () => {
    const out = formatOrgContext({
      company_name: "Acme",
      team_function: "Engineering",
      team_methodology: "Scrum",
      company_mission: "Do good work",
    });

    expect(out).toContain("Company context:");
    expect(out).toContain("Team context:");
    expect(out).toContain("Ways of working:");
    expect(out).toContain("Culture:");
  });

  it("joins array fields with commas", () => {
    const out = formatOrgContext({ countries: ["AU", "NZ"], key_tools: ["Jira", "Slack"] });

    expect(out).toContain("Countries: AU, NZ");
    expect(out).toContain("Key tools: Jira, Slack");
  });

  it("ignores empty arrays", () => {
    expect(formatOrgContext({ countries: [], key_tools: [] })).toBeNull();
  });
});
