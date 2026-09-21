<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Surface Area Map

`strategic_initiatives` serves both `/map` (areas) and `/initiatives`, split by `kind`.
Read [`docs/surface-area-map.md`](docs/surface-area-map.md) before changing anything under
`lib/map/`, `components/map/` or migrations 041-045 — it records the cross-tenant
reference invariant, why the attention rule excludes what it excludes, and the `sr-only`
positioning trap.
