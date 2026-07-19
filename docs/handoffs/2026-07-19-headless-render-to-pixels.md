# Handoff: headless render-to-pixels at explicit scale

## Goal

Give `@weasel-js/core` a first-class way to render a scene (or a set of nodes)
to raw pixels at a caller-supplied scale, with no DOM canvas on screen and no
ambient environment reads. One renderer, two callers: the on-screen view and
offline rasterization (printing, thumbnails, exports).

## Why now

`lbx-editor` prints Brother P-touch labels via the `obwat` package
(`~/src/obwat`), which consumes a plain RGBA bitmap at the printer's native
dot grid. Because weasel has no headless render API, lbx-editor grew a
**second, hand-rolled renderer** for the print path:
`~/src/lbx-editor/src/labelRender.ts`. It re-implements image/rect/line/text
drawing on its own canvas — every feature the real renderer gains is a future
WYSIWYG divergence between screen and paper. The fix belongs here, not there:
weasel provides "render at scale N to pixels," and lbx-editor's file shrinks
to unit math plus one call.

Read `labelRender.ts` before designing — it is the spec-by-example for what
the API must be able to express (including its deliberate anisotropy, below).
Note the technology gap: weasel's renderer is WebGL2 (`WeaselRenderer.ts`,
GL mesh/texture caches) while lbx-editor's print path is Canvas 2D — so today
screen and print don't even share a rendering technology, let alone code.

## Requirements

1. **Explicit scale, separate per axis.** The API takes something like
   `{ scaleX, scaleY }` (output pixels per scene unit). Anisotropic scale is a
   hard requirement, not a nicety: the label print path deliberately squeezes
   the vertical axis (`printableDots / fullTapeHeightDots`) while the
   horizontal axis uses the full dots-per-unit factor. A single
   `pixelsPerUnit` cannot express this.
2. **Explicit source rect.** Caller names the scene-space rect to render
   (origin + size in scene units). Output pixel dimensions follow from
   rect × scale (document the rounding policy).
3. **No ambient density reads.** The headless path must never touch
   `window.devicePixelRatio` — density arrives as the scale argument, per
   call. While in there, audit the existing render path's dPR usage (grep
   hits: `src/canvas/sceneViewRender.ts`, `src/core/viewport/useCanvasSize.ts`,
   `src/canvas/Canvas.tsx`) and refactor toward "density is a parameter the
   screen caller supplies" so screen and headless rendering share one code
   path. The screen behavior must not change.
4. **Injectable surface/context provisioning.** Caller can supply the render
   target: an existing `WebGL2RenderingContext`, an `OffscreenCanvas`, or a
   test fake (`WeaselRenderer` already accepts `opts.gl` — build on that).
   Default may auto-pick, but the injection point must exist so the API is
   testable in vitest (jsdom has no real webgl2 — follow the existing
   glRecorder/stub patterns in `src/renderer/test-utils/`) and usable in a
   worker. Decide and document context lifetime for one-shot renders
   (create/dispose per call vs caller-owned context) and context-loss
   behavior.
5. **Injectable bitmap resolution.** Image nodes render via a caller-supplied
   resolver (cf. `getImageBitmap` in lbx-editor's `labelRender.ts`), so
   consumers reuse their own decode caches. Unresolved bitmaps need a
   documented, deterministic fallback.
6. **Single, high-quality resample.** A bitmap node's source pixels are
   sampled once, directly to the output grid at final scale — never through an
   intermediate raster that gets rescaled. This is a print-quality invariant
   (dithering happens downstream on the native grid; double resampling causes
   moiré/softness). The GL renderer has two live hazards here:
   - `GLImageCache`/`GLTextureCache` upload textures with `LINEAR` min/mag
     and **no mipmaps**. Bilinear-only minification undersamples: a large
     source image drawn small at print scale will alias (moiré). The headless
     path needs proper minification — mipmaps + `LINEAR_MIPMAP_LINEAR`, or a
     CPU prescale to ≤2× target size before upload, or equivalent. Screen
     rendering likely wants the same fix, but don't regress its perf
     silently.
   - Scale-dependent cached artifacts (mesh tessellation in `GLMeshCache`,
     gradient ramps, anything tessellated/rasterized "good enough for screen
     zoom") must be regenerated or verified adequate at the requested output
     scale — print scale can far exceed any screen zoom the cache has seen.
     Audit what the cache keys actually include.
7. **Background policy as a parameter.** Transparent by default; callers can
   pass a background fill (print passes white). No hardcoded background.
8. **Plain output, correctly read back.** Return `ImageData` (or `{ width,
   height, data: Uint8ClampedArray }` — structurally what obwat's `RgbaImage`
   expects). GL readback details are the API's job, not the caller's:
   `gl.readPixels` returns rows bottom-up (flip to top-down image order), and
   the framebuffer holds **premultiplied** alpha per the renderer's
   `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` — unpremultiply on readback (moot
   over an opaque background, but the API shouldn't return premultiplied data
   for the transparent-background case). No obwat import, no printer/dpi/mm
   concepts anywhere in weasel — physical units are the caller's business.
   That boundary is deliberate; do not add a `dpi` option "for convenience."

## Non-goals

- No dependency on obwat, and no printing/label/tape vocabulary in the API.
- No changes to scene model or node types.
- Do not port lbx-editor's text rendering (`drawLabelText`) into weasel —
  weasel renders its own node kinds; lbx-editor will adapt on its side.
- Migrating lbx-editor itself is a follow-up in that repo, not part of this
  work — but keep its `labelRender.ts` open as the acceptance yardstick:
  after this lands, that file must be expressible as unit math + one weasel
  call.

## Acceptance

- Unit tests (TDD per repo conventions) covering: scale math incl.
  anisotropic scales, source-rect cropping, background parameter, bitmap
  resolver fallback, readback orientation + unpremultiply, and a regression
  guard that the headless path performs zero `devicePixelRatio` reads (e.g.
  spy on the global). Command-stream tests can use the glRecorder pattern;
  pixel-level assertions need a real GL context (browser spec alongside
  `canvas-gl.spec.ts`). Determinism claims are same-context only — GL
  rasterization is not byte-identical across drivers, so no golden-image
  tests against committed bytes.
- Existing screen rendering tests/storybook demos unaffected.
- A terse demo under `apps/site/demos/` only if it earns its keep per the
  demo conventions in CLAUDE.md; otherwise tests suffice.
- `docs/TODO.md` updated per repo convention.

## Process notes

- Read the repo's `CLAUDE.md` and `AGENTS.md` first; follow the taxonomy doc
  before renaming anything in gesture/action/interaction territory.
- npm is canonical — never commit `pnpm-lock.yaml`.
- Renderer internals live in `src/renderer/` and `src/canvas/`; survey both
  before choosing where the headless entry point lives.

## Status — landed 2026-07-19

Implemented on branch `headless-render-to-pixels` as `renderSceneToPixels`
(`src/canvas/renderSceneToPixels.ts`); see the plan at
`docs/superpowers/plans/2026-07-19-headless-render-to-pixels.md`.
Notes against the spec:
- Req 6: mipmap fix applies to `GLImageCache` only — `GLTextureCache` is the
  MSDF atlas cache, where mipmaps are deliberately excluded (they corrupt the
  SDF signal). Tessellation regenerates at output scale via
  `flattenTolerance` through the transient pool (mesh cache key is
  Path-identity only). Gradient ramps (1×256, LINEAR) verified adequate for
  8-bit output.
- Acceptance: `canvas-gl.spec.ts` no longer exists; the real-GL spec is
  `tests/visual/render-to-pixels.spec.ts` (no committed baseline).
- lbx-editor migration: **DONE 2026-07-19** (lbx-editor commit `8597c90`).
  `labelRender.ts` is now unit math + one `renderSceneToPixels` call, passing
  the app's screen `drawOne` (so its text/image bitmap caches ride along;
  `resolveImage` unused). Mapping as predicted:
  `scale.x = dpi/72`, `scale.y = printableDots / tapeWidthPt`,
  `sourceRect = {0, 0, labelLengthPt, tapeWidthPt}`, `background: '#ffffff'`.
  Verified in-app: the print click's OffscreenCanvas held the correct
  360×128 raster for a 144pt label on 24mm tape.
