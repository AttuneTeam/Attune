import { chatMessagesToTiptapJson, markdownToTiptapJson } from "./markdownToTiptap";

/**
 * markdownToTiptap converts AI-generated markdown into the Tiptap JSON stored in
 * interactions.raw_json_notes. It is hand-rolled (no markdown library, to avoid
 * ESM bundler issues), so its supported subset is deliberately narrow — these
 * tests pin both what it handles and where it stops.
 */

describe("markdownToTiptapJson", () => {
  describe("headings", () => {
    it("converts levels 1 to 3", () => {
      const doc = markdownToTiptapJson("# One\n\n## Two\n\n### Three");

      expect(doc.content.map((n) => [n.type, n.attrs?.level])).toEqual([
        ["heading", 1],
        ["heading", 2],
        ["heading", 3],
      ]);
    });

    it("treats level 4+ as a paragraph, since only 1-3 are matched", () => {
      const doc = markdownToTiptapJson("#### Four");

      expect(doc.content[0].type).toBe("paragraph");
      expect(doc.content[0].content?.[0].text).toBe("#### Four");
    });
  });

  describe("lists", () => {
    it("groups consecutive bullets into one bulletList", () => {
      const doc = markdownToTiptapJson("- alpha\n- beta\n- gamma");

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe("bulletList");
      expect(doc.content[0].content).toHaveLength(3);
      expect(doc.content[0].content?.[0].content?.[0].content?.[0].text).toBe("alpha");
    });

    it("accepts both - and * as bullet markers", () => {
      const doc = markdownToTiptapJson("* star\n- dash");

      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].content).toHaveLength(2);
    });

    it("groups consecutive numbered items into one orderedList", () => {
      const doc = markdownToTiptapJson("1. first\n2. second");

      expect(doc.content[0].type).toBe("orderedList");
      expect(doc.content[0].content).toHaveLength(2);
    });

    it("separates a list from a following paragraph", () => {
      const doc = markdownToTiptapJson("- item\n\nAfter the list.");

      expect(doc.content.map((n) => n.type)).toEqual(["bulletList", "paragraph"]);
    });
  });

  describe("inline marks", () => {
    it("marks **bold**", () => {
      const doc = markdownToTiptapJson("plain **loud** plain");

      expect(doc.content[0].content).toEqual([
        { type: "text", text: "plain " },
        { type: "text", text: "loud", marks: [{ type: "bold" }] },
        { type: "text", text: " plain" },
      ]);
    });

    it("marks *italic* and _italic_ identically", () => {
      const star = markdownToTiptapJson("*lean*").content[0].content?.[0];
      const under = markdownToTiptapJson("_lean_").content[0].content?.[0];

      expect(star).toEqual({ type: "text", text: "lean", marks: [{ type: "italic" }] });
      expect(under).toEqual(star);
    });

    it("prefers bold over italic when both could match", () => {
      // The alternation tries **bold** first; otherwise "**x**" would parse as
      // an italic containing a stray asterisk.
      const doc = markdownToTiptapJson("**both**");

      expect(doc.content[0].content?.[0].marks).toEqual([{ type: "bold" }]);
    });

    it("marks `inline code`", () => {
      const doc = markdownToTiptapJson("run `npm test` now");

      expect(doc.content[0].content?.[1]).toEqual({
        type: "text",
        text: "npm test",
        marks: [{ type: "code" }],
      });
    });
  });

  describe("code blocks", () => {
    it("captures the language and preserves inner newlines", () => {
      const doc = markdownToTiptapJson("```ts\nconst a = 1;\nconst b = 2;\n```");

      expect(doc.content[0]).toEqual({
        type: "codeBlock",
        attrs: { language: "ts" },
        content: [{ type: "text", text: "const a = 1;\nconst b = 2;" }],
      });
    });

    it("records a null language when the fence is bare", () => {
      const doc = markdownToTiptapJson("```\nplain\n```");

      expect(doc.content[0].attrs).toEqual({ language: null });
    });

    it("does not apply inline marks inside a code block", () => {
      const doc = markdownToTiptapJson("```\n**not bold**\n```");

      expect(doc.content[0].content?.[0].text).toBe("**not bold**");
      expect(doc.content[0].content?.[0].marks).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("returns a single empty paragraph for an empty string", () => {
      expect(markdownToTiptapJson("")).toEqual({
        type: "doc",
        content: [{ type: "paragraph" }],
      });
    });

    it("returns a single empty paragraph for whitespace only", () => {
      expect(markdownToTiptapJson("   \n\n  \t ")).toEqual({
        type: "doc",
        content: [{ type: "paragraph" }],
      });
    });

    it("never returns a doc with empty content", () => {
      // Tiptap rejects a doc whose content array is empty, so the fallback
      // paragraph is load-bearing rather than cosmetic.
      for (const input of ["", "   ", "\n\n\n"]) {
        expect(markdownToTiptapJson(input).content.length).toBeGreaterThan(0);
      }
    });

    it("does not throw on unterminated markup", () => {
      for (const input of ["**unclosed", "`unclosed", "```ts\nno end fence", "- "]) {
        expect(() => markdownToTiptapJson(input)).not.toThrow();
      }
    });
  });

  describe("known limitations", () => {
    it("does not convert links — they stay literal text", () => {
      // parseInline handles bold/italic/code only. If link support is ever added,
      // this test should fail and be rewritten.
      const doc = markdownToTiptapJson("see [the docs](https://example.com)");

      expect(doc.content[0].content?.[0].text).toBe("see [the docs](https://example.com)");
      expect(doc.content[0].content?.[0].marks).toBeUndefined();
    });

    it("does not nest indented list items", () => {
      // An indented bullet fails the /^[-*]\s/ test and becomes a paragraph.
      const doc = markdownToTiptapJson("- parent\n  - child");

      expect(doc.content.map((n) => n.type)).toEqual(["bulletList", "paragraph"]);
    });
  });
});

describe("chatMessagesToTiptapJson", () => {
  it("keeps assistant turns and drops everything else", () => {
    const doc = chatMessagesToTiptapJson([
      { role: "user", text: "a question" },
      { role: "assistant", text: "an answer" },
      { role: "system", text: "instructions" },
    ]);

    const texts = doc.content.flatMap((n) => n.content?.map((c) => c.text) ?? []);
    expect(texts).toContain("an answer");
    expect(texts).not.toContain("a question");
    expect(texts).not.toContain("instructions");
  });

  it("separates turns with a blank paragraph", () => {
    const doc = chatMessagesToTiptapJson([
      { role: "assistant", text: "first" },
      { role: "assistant", text: "second" },
    ]);

    expect(doc.content.map((n) => n.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(doc.content[1]).toEqual({ type: "paragraph" });
  });

  it("skips assistant turns that are blank", () => {
    const doc = chatMessagesToTiptapJson([
      { role: "assistant", text: "   " },
      { role: "assistant", text: "real" },
    ]);

    const texts = doc.content.flatMap((n) => n.content?.map((c) => c.text) ?? []);
    expect(texts).toEqual(["real"]);
  });

  it("returns a single empty paragraph when there are no messages", () => {
    expect(chatMessagesToTiptapJson([])).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});
