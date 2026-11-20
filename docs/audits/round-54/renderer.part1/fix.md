All 14 findings fixed: 10 distinct defects, since four were reported by both reviewers. One more defect turned up while fixing and is fixed too. The gate passes.

- Outline-glyph meshes jitter far from the origin (A): fixed 6f344e3f47
- `meshGradientXml` space-joins colors, so functional-notation colors don't round-trip (A+B): fixed 9f1ac15062. Colors are now written `;`-separated, and the svg reader still reads old space-separated files.
- Mesh bake is straight alpha under bilinear sampling, giving dark rims at patch edges (A+B): fixed 1a73d0c6af. `bakeMesh` now returns premultiplied texels and the GLSL and WGSL shaders no longer multiply again.
- Composite names are looked up on a plain object, so unknown or inherited names misbehave (A+B): fixed ed81cd1e05. This was a strict call: an unknown name throws a `RangeError` naming it, recorded in `docs/unruled.md` under round fifty-four.
- `meshFromStops` drops the padded ends, and a hard break or a lone stop at 1 gives an empty mesh (A+B): fixed b2ef422a64. `meshStops` now trims the pad stops on the way back, so the round trip keeps the stops in place.
- `renderIdsAsync` throws synchronously instead of rejecting (A): fixed ed13c671a8
- A mesh patch color that doesn't parse throws out of the render, and a patch with three colors reads an undefined corner (B): fixed b53977b0b9. The renderer skips the patch with a development warning, and the svg reader drops it with a warning.
- A vector image's first raster is made at its declared size with no cap (B): fixed c091ab39a7
- A blurred drop shadow's interior is about 70% of its color (B): fixed e84792d4df. Each layer now has its own opacity: `dropShadowLayers` gains `alphas` and `TextFrame.shadow` carries them, while the old single `alpha` and `opacity` stay as deprecated fields. Text-node shadows in SVG export are fixed too. The renderer and text-tools changesets are `minor`, because `alphas` is new API.
- `imageStatus` counts as an image read for minted bitmap names only (B): fixed ed072ab112

Extra:
- `readPixels` threw synchronously on a bad rect instead of rejecting (sweep): fixed in ed13c671a8, together with `renderIdsAsync`. The existing test had asserted the synchronous throw and now expects a rejection.

Checks:
- Every touched test file, one at a time with `--maxWorkers=1`: pass. That is `drawText.rotate`, `drawText.outline`, `meshPaint/bake`, `meshPaint/meshStops`, `meshPaint/handles`, `meshPaint/surface`, `effects/compositeOp`, `WeaselRenderer.renderIds`, `readPixels`, `images/imageLoader`, `images/imageCache`, `images/imageCache.adopt` and `dropShadow` in renderer; `svg/mesh`, `svg/fromKit` and `svg/framedText`; `core/paint/meshKind`; `textFrame`, `textPainter.drawn` and `stickyNode` in text-tools; `boxShadow`, `boxShadow.pbt`, `menu/panelCommands` and `menu/menuWidget` in hud; `ui` GradientEditor and MeshHandles.
- `svg/fromKit.test.ts` failed once on its old expectation of a single 0.16 shadow opacity; I updated the test and it passes.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run check:changesets`: "OK — 2600 changeset(s)."
- `npm run lint -w` for renderer, svg, text-tools and core: none of these packages has a `lint` script, so I ran eslint on every changed file instead: pass, exit 0. The root `npm run lint` passed inside the gate.
- Unrun: the browser tests that touch this code (`meshBakeSize.browser`, `textPaint.browser`, and the WebGPU parity tests).

Tree clean.

tally: 14 of 14 fixed, 1 extra fixed