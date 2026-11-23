`parseColor` threw on percent a, b and C in `oklab()` and `oklch()` (A): fixed cf929ba8fb

`parsesAsColor`'s fallback accepted `color(srgb …)` values that `parseColor` rejects (A): duplicate of the B finding below

Gamut clipping bisected the requested chroma in 5 steps, landing up to half the ceiling short (B): fixed ace0d467f8. It now bisects to within 1e-6 chroma of the boundary. A theme test, `generate.test.ts` "reports a palette that equalizing pushed below the contrast floor as infeasible", relied on a 4.5 contrast floor. Its palette now clears that floor by 0.014. The test now uses a 4.52 floor and also checks that `equalize: 0` stays feasible at that floor.

Gradient stops blended without premultiplying, unlike `mixRgba` and `lerpPaint` (B): fixed 6659b8f167. The gradient's swatch (`paintPreview`), the GL ramp and PDF shading all sample through the function that changed, so they change too. One gap is left, noted in the commit body: in an OKLCh gradient the hue uses the premultiplied weight, while CSS leaves hue unpremultiplied. `lerpColorArray` has no separate hue weight to carry that.

`tryParseColor` threw and caught an error on every call for an unreadable color, and failures were never cached (B): fixed a058a2311f. Failures are now cached as null, and `tryParseColor` no longer throws internally.

`parsesAsColor`'s fallback accepted `color()` bodies that `parseColor` rejects (B, same claim as A's): fixed fea1711673

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/paint/src/color.test.ts`: pass (54)
- `npx vitest run --maxWorkers=1 packages/paint/src/colorSpaces.test.ts`: pass (20)
- `npx vitest run --maxWorkers=1 packages/paint/src/cssColor.test.ts`: pass (7)
- `npx vitest run --maxWorkers=1 packages/paint/src/gradient.test.ts`: pass (35)
- `npx vitest run --maxWorkers=1 packages/theme/src/engine/color/generate.test.ts`: pass (23)
- Wider runs:
  - paint, renderer cache, pdf and GradientEditor: pass (869, 1 skipped)
  - theme, animator, prefs, hud and renderer meshPaint/cache: pass after the fixture retune; before it, the one failure above
- `npm run checks:gate`: all 33 passed. The first run failed `npm run lint` with `weasel/no-hand-lerp` in `gradient.ts`; I fixed it in 6659b8f167.
- `npm run lint -w @weasel-js/paint` and `npm run lint -w @weasel-js/theme`: neither package has a lint script. The root `npm run lint` passes inside the gate.

tally: 5 of 6 fixed, 0 extra fixed