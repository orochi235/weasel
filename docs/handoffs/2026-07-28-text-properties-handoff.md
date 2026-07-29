# Handoff — text properties (spec 2 of 2)

Spec 1 (`@weasel-js/font` extraction) is **done and merged to main**, green through the
full `prepublishOnly` gate plus visual. 34 commits unpushed; nothing published.

Your work: `docs/superpowers/plans/2026-07-28-text-properties.md` (13 tasks).
Spec: `docs/superpowers/specs/2026-07-28-text-properties-design.md`.

## What landed that you depend on

`@weasel-js/font` is a Tier A leaf; core depends on it. Surface you'll use:

- `listFonts(): readonly RegisteredFont[]` — `{ family, variants: [{ weight, style }] }`,
  families in registration order. **Baked-atlas registry only** — canvas-enrolled
  families are deliberately excluded. Plan Task 11 has a note on how the picker
  should present that; read it before writing `FontFamilySelect`.
- `ResolveResult.substituted?: { requested, resolved }` — set when a cross-family
  fallback fired. This is what the picker surfaces as "Inter — not loaded, showing
  Roboto." It is a real field, populated, and wired through to the renderer.
- `ResolveResult.resolved` is now `{ family, weight, style }` — it gained `family`.
  `layoutRuns` keys groups by the **atlas** family, so two families substituting to
  the same atlas merge into one draw call.
- `setFontFallbackPolicy('substitute' | 'canvas' | 'none')`, default `'substitute'`;
  `setDefaultFontFamily`. `isCanvasFont` now answers "served by the dynamic tier
  *right now*", not "enrolled" — it is policy-aware.

Unregistered families render in a substitute and warn once. Four distinct warn-once
messages cover the silent-failure paths.

## Corrections already folded into the plan — don't re-derive them

1. **DOM overlay uses inline styles, not element wrappers.** `runsToDom` builds one
   `<span data-run>` per run and sets `style.fontWeight` etc. Decoration goes on as
   `style.textDecoration`; do **not** introduce `<u>`/`<s>`, which would give
   `domToRuns` a second representation to unwrap.
2. **`data.style.fill.color`, not `data.style.fill`.** `TextStyle.fill` is a
   `FillStyle` union; the `color` leaf kind edits a string. The four-segment path
   works once Task 1's N-segment paths land. Non-solid fills read `undefined` — known
   v1 limitation.
3. **Font family is a `custom` leaf (`kind: 'font-family'`), not `enum`.** The schema
   is built at module load; fonts register asynchronously, so static options are
   always stale. `SelectionPanel` dispatches custom kinds to app renderers, and draw
   already passes `renderers={WD_RENDERERS}`.
4. Leaf kinds are `number | boolean | string | enum | color | custom`
   (`packages/core/src/tools/prefs.ts`).

## Tighten these before dispatching

Plan Tasks **4, 6, and 8** specify test *intent* with ellipses rather than complete
bodies, because they run against harnesses I hadn't read in full: `useTextEdit.test.ts`'s
selection simulation, `makeGLRecorder`'s assertion API, and the svg test fixtures. Read
those three harnesses and write the real bodies first. Fabricating exact code against an
unread harness is worse than the gap.

## What this arc taught, applied to yours

Two-stage review caught **seven** defects in my plan. Every one passed a green suite
first. The worst was Critical: I specified the font-package half of the fallback feature
and never the core-side wiring, so substitution was reported correctly and then dropped
at the renderer — text laid out with the substitute's metrics and painted nothing, which
was *worse* than the trap it replaced.

The lesson for spec 2, which has the same shape: **when a feature spans a producer and a
consumer, spec both halves and test the consumer end.** Your Tasks 5–7 (tracking,
decoration) produce data that Task 11's controls consume. Assert on uploads and draw
calls, not on the data structure.

Green tests are not evidence of completeness. They were green for all seven.

## Repo constraints

- **Never `git add -A`** — another session shares this checkout, and an untracked
  `2026-07-28-arbitration-followups.md` at the root belongs to it. Stage explicit paths.
- Branch from `main`; do not push (needs explicit OK).
- `npm run test:kit` = core; `npm run test:ui` = everything else under `packages/`
  (including `packages/font`); `npm run test:draw` = the app.
- Full gate: `npm run typecheck && npm run test && npm run build && npm run
  check:manifests && npm run test:smoke:consumer`, then `npm run test:visual`.
  `npm run test` alone does not typecheck production code.

## Release

`.changeset/font-package-extraction.md` is staged for **0.7.0** across all twelve
packages (lockstep `fixed` group). Your work adds its own `minor` changeset and rides the
same release if it lands before publish; if spec 1 publishes alone, yours becomes 0.8.0 —
it cannot retroactively join.

Unlike spec 1, your Tasks 5–7 **do** change rendering, so new visual baselines are
expected. Inspect the diffs — an underline should sit under the glyphs, not through them
— before running `test:visual:update`.

## Open question, not blocking you

`packages/font/src/GlyphLayout.ts` — 116 lines, no callers anywhere, currently
unexported. Delete, or export as intentional public surface? Free now, breaking after
0.7.0 publishes.
