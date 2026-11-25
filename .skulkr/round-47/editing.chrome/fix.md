fixed 8eb0af4869 | The rotate badge was painted on a node that can't rotate, and on a multi-selection holding one, where it can't be grabbed (A+B). The overlay, the rotate ring and the badge's grab region now all ask one predicate, `targetCanRotate`, in `rotationHandleGeometry.ts`.
fixed 52e0aba5d8 | The selection outline dropped `dashOffset`, `miterLimit`, `trim` and markers from the consumer's stroke (A). It now passes the whole stroke through and fills in only the paint and width defaults.
fixed 864a5e7e62 | The shape-outline cache kept an open path's old band after the stroke it inherits changed caps or markers (A). The cache key now includes the inherited paint, which `inheritedPaintIn` hands back as the same object while it doesn't change.
fixed b5053f0a59 | `boxReader` dropped `scene.shapes`, so selection boxes and handles ignored the scene's own painters (B). It now passes `shapes` through.

No extra defects found while fixing.

Checks:
- `npx vitest run --maxWorkers=1 packages/editing/src/chrome/overlay.test.ts`: pass (42)
- `npx vitest run --maxWorkers=1 packages/editing/src/chrome/shapeOutline.test.ts`: pass (10)
- `npx vitest run --maxWorkers=1 packages/editing/src/chrome/affordances/rotationHandle.test.ts`: pass (18)
- Also re-run because they cover the same code: `drawnChrome.test.ts` pass (5), `emptyContainer.test.ts` pass (3), `overlay.transform.test.ts` pass (6)
- Each new test failed before its fix.
- No `*.browser.test.*` file touched. `shapeOutline.browser.test.tsx` and `transformedChrome.browser.test.tsx` cover changed code but can't run here (unrun).
- `npm run check:changesets`: pass (`OK — 2234 changeset(s)`)
- `npm run checks:gate`: pass (`checks:gate: all 32 passed`)
- `npm run lint -w @weasel-js/editing`: not run. `@weasel-js/editing` has no `lint` script (npm reports the script missing). The root `npm run lint` inside the gate passed.
- The tree is clean, and `.skulk/` is untouched.