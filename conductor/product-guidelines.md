# Product Guidelines: TeamLeader

These guidelines govern how TeamLeader looks, sounds, and behaves. `DESIGN.md` at the
repo root remains the detailed visual specification; this document is the operating
summary plus the verbal and behavioural layer that `DESIGN.md` does not cover.

---

## 1. Creative North Star: The Curated Workspace

TeamLeader deliberately rejects the utilitarian SaaS-dashboard aesthetic. The target
feeling is a **calm, high-end editorial experience** — closer to a physical mahogany
desk than a digital screen.

This is not decoration. A manager opens this tool to think carefully about people, often
about difficult situations. A crowded, boxy, alert-heavy interface actively works
against that. Cognitive ease is a product requirement.

---

## 2. Visual System (Operating Rules)

Three rules define the aesthetic more than anything else. Breaking them is what makes
new UI look "off-brand":

### The No-Line Rule
**Never use 1px solid borders to section off the UI.** Define boundaries through:
- Background shifts between surface levels
- Soft insets — a lighter surface nested inside a darker container
- Generous whitespace

### The Divider Ban
No `<hr>`, no `border-bottom` between list items. Separate items with vertical space
(24px minimum) or by alternating surface colours.

### Tonal Layering, Not Shadows
Depth comes from value contrast between stacked surfaces, not drop shadows. When
something genuinely floats (a modal), use an ultra-diffused shadow tinted with the
foreground colour, never black:
`0px 24px 48px rgba(56, 56, 49, 0.06)`

### Surface Hierarchy
| Level | Role | Light | Dark |
|---|---|---|---|
| 0 — Canvas | Page background | `#fcf9f2` | `#232b1b` |
| 1 — Sections | Sidebar, large regions | `#fcf9f2` | `#232b1b` |
| 2 — Cards | Primary interaction areas | `#fcf9f2` | `#2c3522` |
| 3 — Floating | Popovers, focused fields | `#ffffff` | `#36402a` |
| Dim | Ambient recessed ground | `#e5e3d9` | `#1a2014` |

### Palette
| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#416c63` | `#6fb49f` | Brand teal. Primary actions, active states |
| `primary-dim` | `#346057` | `#5a9c88` | Gradient partner for primary CTAs |
| `secondary` | `#c8ddd9` | `#3a4a28` | Pills and chips — low-contrast, soothing |
| `tertiary` | `#b43a10` | `#e07038` | Coral "highlighter". High-priority CTAs and critical data points **only** |
| `foreground` | `#383831` | `#ecead2` | Text. **Never pure black** |
| `destructive` | `#af3d3b` | `#d05c5c` | Errors and destructive actions |

**`tertiary` is a scalpel, not a paintbrush.** Its power comes from scarcity — an
overdue count, one urgent CTA. Two coral elements on a screen is usually one too many.

### Dark Mode Is First-Class
The dark theme is a **deep olive green**, deliberately not charcoal. Every colour
decision must be made in both themes, using tokens rather than literal hex values.
A component styled only for light mode is incomplete.

### Typography
- **Anchors:** display and headline sizes with tightened letter-spacing (`-0.02em`).
- **Details:** small, well-tracked labels for metadata.
- **Go big or go small.** Avoid a screen of uniformly medium-sized text — the contrast
  between large headlines and small labels is what reads as high-end.

### Shape
Radius scale: `sm` 0.3x · `md` 0.5x · `lg` 1rem (base) · pills `9999px`.
Cards use `lg` with at least 24px inner padding.

### Layout
Prefer **asymmetry**. A 70/30 main-content-to-sidebar split reads as more considered
than 50/50. If a section feels crowded, double the padding before shrinking the font.

---

## 3. Product Voice

**Personality: a trusted, experienced peer.** TeamLeader speaks the way a seasoned
manager two rungs ahead of you would — direct, specific, unhurried, and never
performatively enthusiastic.

### Do
- **Be specific.** "Sentiment has declined across the last three 1-on-1s with Sam" beats
  "Attention needed."
- **Lead with the finding**, then the reasoning. The manager is busy.
- **Use plain professional English.** British spelling (`summarise`, `organisation`,
  `prioritise`) — the product's existing copy and prompts use it.
- **Stay calm.** The product surfaces difficult things — a struggling report, a slipping
  initiative. Calm delivery is what makes those findings usable.

### Don't
- **No exclamation marks** in product copy. No "Great job!", no "Oops!".
- **No corporate filler.** Never "leverage", "synergy", "unlock", "supercharge".
- **No anxiety-inducing alarm language.** "Worth a look" not "URGENT — ACTION REQUIRED".
- **No cheerfulness about hard things.** A negative sentiment trend is reported plainly,
  not softened into a growth opportunity.

---

## 4. AI Output Guidelines

AI-generated content is the product's core value, and it is held to a higher bar than
UI chrome.

### Be objective and constructive
This phrasing already anchors the system prompts and should stay. The AI describes what
it observed; it does not editorialise about a person's character.

### Never judge the person
Analyse conversations, themes, and sentiment — **never the individual's worth,
competence, or standing.** The non-goals in `product.md` (no performance review, no
surveillance) apply with full force to AI output. "The discussion returned repeatedly to
unclear scope" is in bounds. "Sam appears disengaged" is not.

### Calibrate to context
Where organisational context, team values, or a persona are available, use them. The
same observation should land differently in a DRI culture than in a consensus-driven one.

### Prefer questions to prescriptions
Coaching output should be open-ended and empowering. Give the manager a better question
to ask, not a script to read.

### Extract only what is real
Action items must be actual commitments, not general discussion points. A confident
hallucination costs more trust than an empty result. **When in doubt, return less.**

### Show the reasoning
For agentic flows, stream the reasoning where the manager can see it. The manager must
be able to audit why the AI reached a conclusion — especially before acting on it with a
real person.

---

## 5. UX Principles

### 1. Surface, don't store
Every screen should answer "what should I pay attention to?" before it answers "what did
I write down?". Passive archives fail the product's second success criterion.

### 2. Zero-friction capture
Writing a note must never be interrupted. Auto-save with debounce, never a Save button
in the primary editing path. The manager's attention belongs on the conversation.

### 3. AI is offered, never imposed
AI output is a suggestion the manager accepts, edits, or discards. Nothing the AI
produces is silently authoritative, and every AI-generated artefact is editable.

### 4. Progressive disclosure
Depth lives behind sheets, panels, and expansion — not on the first screen. The default
view stays calm; detail is one deliberate click away.

### 5. Integrations enrich, never gate
Every core workflow must be complete without a single integration connected. Integration
data is additive context. This follows directly from "any people manager" as the primary
user.

### 6. Respect the human on the other side
The product describes a real person who is not in the room. Every feature is designed as
though that person might one day read it. If a screen would embarrass the manager if the
report saw it, it is wrong.

### 7. Fail quietly and honestly
When an AI call or integration fails, say so plainly in a toast and leave the manager's
work untouched. Never lose written content, never invent a fallback result.

---

## 6. Known Drift

Flagged during setup, to be reconciled:

- **`DESIGN.md` specifies Geist**; the application actually loads **Inter**
  (`--font-inter` for sans, mono, and heading).
- **`DESIGN.md` lists `surface: #fcffdc`** as the Level 0 canvas; the implementation
  uses `#fcf9f2`.
- **Surface levels 0-2 are currently the same value** (`#fcf9f2`) in light mode, with
  the intended card colour commented out. The "tonal layering" principle is therefore
  only partially realised in light mode.
- **`DESIGN.md` predates dark mode entirely** and does not describe the olive theme.
