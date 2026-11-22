- paintPreviewCss puts a non-`bounds` radial or conic gradient's center far off the chip (A+B): fixed e9e62fdf60
- paintPreviewCss throws on a stop color parseColor can't read (A+B): fixed 266eef3414
- mixRgbaWeighted returns the first color when every weight is zero (A+B): fixed 607dd8536c
- paintWithAlpha lets NaN through as the opacity (A+B): fixed d8727943af
- cssColorNotation writes `none`, which parseColor rejects (B): fixed f29796c159. parseColor now reads `none` as 0 in the space-separated syntax and still refuses it in the comma syntax.
- parsesAsColor's fallback accepts any body inside a color function (A): fixed ff4d9c34fe. `rgb()`, `hsl()`, `oklab()` and `oklch()` now count as colors only where parseColor reads them. Relative syntax, `calc()` and the color functions parseColor doesn't read keep the shape check.
- lerpPaint throws on an unreadable solid or stop color (B): fixed d8cea8a451. Such a paint now holds until halfway, the same rule as other paints that can't mix.
- lerpStroke turns a `{ px }` stroke's missing vertexWidths entries into fixed world widths (B): fixed 11553ae025. On a px side, a missing entry or side now keeps the nearer stroke's value as it stands. This is a judgment call, recorded in `docs/unruled.md`.
- OKLCH is mapped into sRGB two different ways (B): fixed 1b387a097d. parseColor now reduces chroma (`oklabToSrgbClipped`), as oklchDegToHex and colorLiteralToHex do.
- Gradient stop sampling blends straight alpha, so a ramp to transparent grays out in the middle (A): question. Should kit gradients blend premultiplied, as CSS does? The straight-alpha ramp is the one definition shared by the GL ramp atlas, the preview and PDF shading, which also lerps straight (`packages/pdf/src/shading.ts` `lerpRgba`). Changing only the sampler would make canvas and PDF export disagree, so this needs a cross-package ruling.

Extra:
- clipToGamut cut up to 3% of the chroma from a color a rounding error past the sRGB edge, such as CSS's pure red `oklch(62.796% 0.25768 29.2339deg)`, which lands 5e-6 past it (sweep): fixed 136e681bee. Channels within 1e-4 of the edge are now clamped rather than chroma-reduced.

Checks:
- Test files touched, one at a time with `--maxWorkers=1`: paintPreview 11 passed, cssColor 7 passed, mix 2 passed, paintDefaults 7 passed, color 52 passed, lerpPaint 17 passed, colorSpaces 19 passed.
- Every non-browser test file outside paint that touches oklch, oklab or chroma, plus all of packages/paint: 87 files, 1016 passed, 1 skipped.
- `npm run checks:gate`: all 33 passed.
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/paint`: the package has no lint script. eslint on every changed `.ts` file: pass.
- The tree is clean apart from `.skulkr/`.

tally: 9 of 10 fixed, 1 extra fixed