import { chunkText } from "./embeddings";

/**
 * chunkText splits interaction notes into ~500-character pieces before they are
 * embedded for semantic search. Chunk boundaries decide what search can find:
 * too greedy and a chunk spans unrelated topics, too eager and a thought is
 * split across two vectors.
 */

const CHUNK_SIZE = 500;

describe("chunkText", () => {
  it("keeps short text as a single chunk", () => {
    const text = "Sam is blocked on the review queue and wants more scope.";

    expect(chunkText(text)).toEqual([text]);
  });

  it("splits on sentence boundaries rather than mid-word", () => {
    const sentence = `${"word ".repeat(40).trim()}.`; // ~200 chars
    const chunks = chunkText([sentence, sentence, sentence].join(" "));

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk).toMatch(/[.!?]$/);
    }
  });

  it("respects ? and ! as sentence terminators", () => {
    const chunks = chunkText("Is Sam blocked? Yes! Escalate to the staff engineer.");

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Is Sam blocked?");
  });

  it("keeps chunks at or under the size limit when sentences allow it", () => {
    const sentence = `${"a".repeat(90)}.`;
    const chunks = chunkText(Array(10).fill(sentence).join(" "));

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(CHUNK_SIZE);
    }
  });

  it("trims surrounding whitespace from every chunk", () => {
    const chunks = chunkText("  First sentence here.   Second sentence here.  ");

    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.trim());
    }
  });

  describe("edge cases", () => {
    it("returns nothing for an empty string", () => {
      expect(chunkText("")).toEqual([]);
    });

    it("returns nothing for whitespace only", () => {
      expect(chunkText("   \n  ")).toEqual([]);
    });

    it("drops fragments of 20 characters or fewer", () => {
      // Deliberate: tiny fragments make noisy, low-signal vectors. The cost is
      // that genuinely short notes are never embedded at all.
      expect(chunkText("Too short.")).toEqual([]);
    });

    it("does not throw on text with no sentence terminators", () => {
      const runOn = "word ".repeat(300);

      expect(() => chunkText(runOn)).not.toThrow();
      expect(chunkText(runOn).length).toBeGreaterThan(0);
    });
  });

  describe("known limitations", () => {
    it("emits an oversized chunk when a single sentence exceeds the limit", () => {
      // There is no intra-sentence splitting: one very long sentence becomes one
      // chunk larger than CHUNK_SIZE rather than being broken up.
      const monster = `${"x".repeat(CHUNK_SIZE * 2)}.`;
      const chunks = chunkText(monster);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].length).toBeGreaterThan(CHUNK_SIZE);
    });
  });
});
