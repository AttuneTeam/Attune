# Design System Strategy: The Curated Workspace

## 1. Overview & Creative North Star

This design system moves away from the utilitarian "software-as-a-service" aesthetic toward **"The Curated Workspace."** Our goal is to transform a team management dashboard from a spreadsheet-adjacent tool into a calm, high-end editorial experience.

By utilizing a "Warm Minimalist" approach, we prioritize cognitive ease. We break the traditional dashboard "boxiness" through intentional asymmetry—pairing wide-format data views with condensed, high-density side-panels. This system relies on the sophisticated tension between pale teal greens and a warm, cream-based background to create an environment that feels more like a physical mahogany desk than a digital screen.

---

## 2. Colors: Tonal Depth & Soul

The palette is built on a foundation of warmth (`background: #F3F0EA`) rather than sterile whites.

### The "No-Line" Rule

**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off the UI. Boundary definition must be achieved through:

- **Background Shifts:** Transitioning from `surface` to `surface_container_low`.
- **Soft Insets:** Placing a `surface_container_highest` element inside a `surface_container` area.

### Surface Hierarchy & Nesting

Treat the UI as a physical stack of fine paper.

- **Level 0 (Base):** `surface` (#fcffdc) is your canvas.
- **Level 1 (Sections):** Use `surface_container_low` (#fcf9f2) for large sidebar or background regions.
- **Level 2 (Cards):** Use `surface_container_highest` (#eae8de) for primary interaction cards.
- **Level 3 (Floating):** Use `surface_container_lowest` (#ffffff) for active popovers or search fields to create a "bleached" focus point.

### The "Glass & Gradient" Rule

To elevate the "out-of-the-box" look, use **Glassmorphism** for floating action menus. Apply `surface_variant` at 60% opacity with a `20px` backdrop-blur.

- **Signature Texture:** For primary CTAs, do not use flat teal. Use a subtle linear gradient from `primary` (#416c63) to `primary_dim` (#346057) at a 135-degree angle to provide a tactile, weighted feel.

---

## 3. Typography: Editorial Authority

We utilize **Geist** to bridge the gap between technical clarity and editorial elegance.

- **Display & Headlines:** Use `display-md` and `headline-lg` with tightened letter-spacing (-0.02em). These are your "Anchors." They should feel like titles in a premium print magazine.
- **Body & Labels:** Use `body-md` for data and `label-sm` for metadata.
- **Hierarchy Note:** High-end design is defined by the contrast between large headlines and small, beautifully tracked labels. Avoid "medium-sized" text everywhere. Go big for titles or go small for details.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are too "digital." We communicate depth through **Tonal Layering**.

- **The Layering Principle:** Place a `surface_container_lowest` (#ffffff) card on top of a `surface_dim` (#e5e3d9) background. The contrast in value provides enough "lift" without requiring a shadow.
- **Ambient Shadows:** When an element must float (e.g., a modal), use an ultra-diffused shadow: `0px 24px 48px rgba(56, 56, 49, 0.06)`. Note the use of `on_surface` (#383831) as the shadow tint rather than pure black.
- **The "Ghost Border" Fallback:** If accessibility requires a border, use the `outline_variant` (#bbb9b0) at 15% opacity. It should be felt, not seen.

---

## 5. Components: The Primitive Set

### Buttons & CTAs

- **Primary:** Gradient of `primary` to `primary_dim`. Text in `on_primary`. Roundedness: `md` (0.75rem).
- **Actionable Pop:** Use `tertiary` (#b43a10) exclusively for high-priority CTAs (e.g., "Add Interaction" or "Delete"). This is our coral "Highlighter" color.
- **Ghost Buttons:** No container. Use `primary` text with an icon. On hover, apply a `surface_container_high` background.

### Cards & Lists

- **The Divider Ban:** Strictly forbid `<hr>` or border-bottom dividers. Use `spacing-xl` (vertical whitespace) to separate list items, or alternate the background color of list items using `surface_container_low` and `surface_container`.
- **Cards:** Use `roundedness-lg` (1rem). Ensure inner padding is generous (at least 24px) to maintain the minimalist vibe.

### Input Fields

- **Styling:** No borders. Use `surface_container_highest` as the background fill. When focused, add a 2px "Ghost Border" of `primary` at 40% opacity.
- **Error States:** Use `error` (#af3d3b) for text, but keep the container `error_container` (#fa746f) at 10% opacity to avoid visual "screaming."

### Signature Component: The Interaction Chip

For dashboard tags (e.g., "Growth Squad," "Positive"), use a "Pill" shape (`roundedness-full`). Use `secondary_container` with `on_secondary_container` text for a low-contrast, soothing appearance.

---

## 6. Do’s and Don’ts

### Do:

- **Do** use asymmetrical layouts. A 70/30 split between main content and sidebar feels more premium than a 50/50 split.
- **Do** embrace whitespace. If a section feels crowded, double the padding before you consider shrinking the font.
- **Do** use `tertiary` (#b43a10) for critical data points (like an overdue task count) to create a sophisticated "ping."

### Don’t:

- **Don’t** use pure black (#000000) for text. Always use `on_surface` (#383831) to maintain the "calm" aesthetic.
- **Don’t** use standard Material shadows. They are too aggressive for this system’s palette.
- **Don’t** use 1px dividers. Use a change in surface color or a `24px` vertical gap.
- **Don’t** use bright greens. Stick to the teal-based `primary` (#416c63) for a professional, "muted" growth vibe.

---

## 7. Roundedness Scale Reference

- **Small (sm):** 0.25rem (Checkboxes, small tags)
- **Default:** 0.5rem (Standard buttons)
- **Large (lg):** 1rem (Dashboard widgets, main cards)
- **Full:** 9999px (Status pills, search bars)
