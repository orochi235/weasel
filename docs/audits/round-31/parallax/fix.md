- Negative bleed empties one axis, so the copy cap passes and the other axis's loop stalls the frame (A+B): fixed bfda27a646
- Bare-number `bleed` widens only x, so content tiled in y pops in at the top and bottom edges (B): fixed 74491863d1. This was a behavior call nobody had made, so I made it and recorded it in `docs/unruled.md`: a bare bleed now covers both axes, while a bare period still wraps x only. A lattice tiled on x alone draws as before.
- `plane.set({ pan: undefined })` stores `undefined` over the pan and every later draw throws (A+B): fixed 1ab2eb3b27. This was also a behavior call, recorded in `docs/unruled.md`: an undefined `pan` in a patch leaves the pan as it was. I didn't make it throw, because an animator's `set({ pan: maybe })` means "no change", not misuse. An undefined `zoom` or `anchor` still resets it to its default.

No extra defects found while fixing.

Checks:
- `npx vitest run --maxWorkers=1 packages/parallax/src/createTiledLayer.test.ts`: pass (22 passed)
- `npx vitest run --maxWorkers=1 packages/parallax/src/createParallaxPlane.test.ts`: pass (4 passed)
- `npm run typecheck:packages -- parallax`: pass ("1/1 parallax ok")
- eslint on `createTiledLayer.ts`, `createTiledLayer.test.ts`, `createParallaxPlane.ts`, `createParallaxPlane.test.ts`: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1241 changeset(s).") after I shortened two changeset titles that were over 140 characters and folded the fixes into their commits.
- Tree clean; `.audit-night/` untouched.