# WebGL Step 3 — Done

**Plan:** [`2026-05-09-webgl-step-3-text-msdf.md`](./2026-05-09-webgl-step-3-text-msdf.md)
**Date completed:** 2026-05-09

## What shipped

- `pnpm gen:font` build script wrapping `msdf-bmfont-xml@2.8.0` (CJK explicitly deferred).
- Inter v4 (Apache-2.0) prebuilt MSDF atlas at `packages/gl/fonts/inter/` — 191 glyphs at 32px, 512×512 atlas, 143KB PNG + 63KB JSON.
- `BmFont` types + `parseBmFont` with `charMap` and `kerningMap` accelerators (`FontAtlas.ts`).
- `layoutGlyphs(text, style, font, origin)` pure function — pen advance, kerning, UV mapping, `?` fallback for unknown codepoints, console.warn skip for missing-with-no-fallback.
- `quadsToVertexBuffer` and `buildQuadIndexBuffer` helpers — interleaved x,y,u,v per vertex, two-triangle quad index pattern.
- `GLTextureCache` — atlas upload (RGBA UNSIGNED_BYTE, linear filter, no mipmaps), `bind(id, unit)`, idempotent `upload`.
- `registerFont(family, metricsUrl, atlasUrl)` async public API — fetches + parses + decodes ImageBitmap. `getFont` lookup. `ensureFontTexture` lazy-uploads to a renderer's textureCache at draw time.
- MSDF text shader (`shaders/textSdf.ts`) — median(r,g,b) for SDF recovery, smoothstep for AA, premultiplied output (conventions §2).
- `WeaselRenderer` extended: compiles `textSdf` program in constructor + on context restore; instantiates `GLTextureCache`; `DrawContext` carries both.
- `kind: 'text'` DrawCommand variant + `drawText` dispatch — dynamic per-draw VBO/VAO (TODO step 7: pool buffers in `createTextLayer` port).
- Public barrel exports: `registerFont`, `TextDrawCommand`.
- Playwright text smoke: 4 canvases (12/16/24/32/48/64px) verify glyphs paint in real Chromium.
- Browser-verified: "Hello, World!" 32px, 16px Lorem ipsum, 64px "Weasel GL" cyan, MSDF zoom test (4 sizes overlaid) — all crisp, no aliasing artifacts.

## Notable deviations from plan

- **Plan specified `msdf-bmfont-xml@6.0.0` — that version doesn't exist on npm.** Latest is 2.8.0; used that. Plan-time version-pinning needs `npm view <pkg> versions` cross-check.
- **Plan's gen-font script used `--charset-start`/`--charset-end` CLI flags that don't exist in 2.8.0.** Real CLI accepts `-i charset-file` only. Updated `gen-font.ts` to write a temp charset file with codepoints 0x20–0xFF and pass `-i`.
- **`@fontsource/inter` ships WOFF2 only; `fonttools` was missing brotli for decompression.** Worked around by downloading Inter v4 directly from the GitHub release zip and extracting the TTF. Documented in this note for whoever rebuilds the atlas.
- **Plan's smoke spec used diagonal pixel sampling** which missed the text region (text occupies a horizontal strip near the top). Switched to a 16×16 grid sample.
- **`textureUploaded` flag on `FontEntry` was wrong.** Each `WeaselRenderer` has its own `GLTextureCache`, so a per-font flag couldn't track per-cache state. First canvas would set the flag, subsequent canvases would skip upload but their own caches were empty. Dropped the flag; rely on `GLTextureCache.upload`'s own has-check for idempotency. Caught only by the browser smoke test — exactly the kind of bug convention §1 warns about.
- **Tasks 10 + 11 merged into one commit** (drawText + WeaselRenderer wiring) — both touch the same `DrawContext` fields and splitting them would have left typecheck broken between commits.
- **Task 13 (gen:font WOFF2 fallback) folded into Task 1's gen-font script** — handled there with charset-file approach. No separate task needed.
- **Task 15 (npm script) folded into Task 1** — script was added to `package.json` simultaneously with the gen-font.ts file.

## Test results

- Vitest: 1384 tests pass (1358 from steps 1+2, 26 new from step 3 — FontAtlas 5, GlyphLayout 12, GLTextureCache 5, registerFont 4).
- Playwright: 3/3 smoke specs pass (smoke + synthetic + text).
- Typecheck: clean.
- Browser-verified: text renders crisp at 12, 16, 24, 32, 48, 64 px sizes.

## Lessons for step 4 (image / pattern / gradient) and beyond

These will be folded into `webgl-stepwise-conventions.md`:

- **Multi-renderer state coupling: don't track per-X state on shared registry entries.** Step 3's `textureUploaded` bug (per-font flag, but each renderer has its own texture cache) is a generic pitfall. When a registry is shared but consumes resources owned by separate renderers, the renderers' resource caches must do their own dedup; the registry shouldn't know about them. **Add convention §9.**
- **Plan-time npm version pinning is risky.** The plan's `msdf-bmfont-xml@6.0.0` was confabulated. For new deps, the implementer should `npm view <pkg> versions` first, then pin the actual latest stable. Add a note to convention §3.
- **Plan-time CLI flag specs are risky for the same reason.** The gen-font script's flags didn't match the real CLI. Run `<tool> --help` before writing the wrapper.
- **Smoke test sample patterns matter.** Diagonal sampling worked for full-canvas scenes (step 1's polygon scatter, step 2's stroked corners) but failed for the text scene (text occupies a narrow strip). Grid sampling is more robust; use it as the default going forward. Update convention §1.
- **The browser caught a real bug the unit tests couldn't.** Convention §1 (mock GL) and §8 (geometry coverage) both apply here, but with a new wrinkle: the bug was in *which renderer holds what state*, which neither convention names directly. The new §9 captures it.

## Open follow-ups

- Inter atlas was generated by hand-downloading the TTF from GitHub releases. The `gen:font` script accepts a TTF path but consumers running `pnpm gen:font` from scratch need to obtain a TTF first — `@fontsource/inter` ships WOFF2 only and `fonttools` decompression requires Python `brotli`. Document a one-line `curl … | unzip` recipe in the gen-font.ts header (or in a CONTRIBUTING note) when step 9 lands.
- Per-renderer dynamic VBO/VAO per draw call is the documented inefficiency. Add buffer pool when `createTextLayer` ports in step 7.
- CJK and complex script shaping (HarfBuzz) explicitly deferred. No follow-up for this step.
- The `Stroke` type's `miterLimit` field still doesn't exist (deferred from step 2). Same status.
- Self-intersecting path stencil-clip stroke composition still has a known edge case (step 2 deferral). Same status.
