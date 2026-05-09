# WebGL Step 5 — Done

**Plan:** [`2026-05-09-webgl-step-5-vertex-colors-and-color-matrix.md`](./2026-05-09-webgl-step-5-vertex-colors-and-color-matrix.md)
**Date completed:** 2026-05-09

## What shipped

- `PathDrawCommand.vertexColors?: number[]` — flat RGBA per-vertex colors, supplied as a plain `number[]` (uploaded into a per-draw dynamic VBO). When present, dispatcher routes the path through a separate program with an `a_color` attribute.
- `GroupDrawCommand.colorMatrix?: number[]` — 4×5 row-major (SVG feColorMatrix-compatible) tint applied to the inner draws.
- `IDENTITY_COLOR_MATRIX` constant + `colorMatrixStack` on `GroupState` with `compose4x5` so nested groups multiply correctly. Identity at top of stack.
- `pathFill` shader extended with `u_colorMatrix` (mat4) + `u_colorBias` (vec4), output convention preserved (premultiplied: `vec4(rgb * a, a)`).
- `pathFillVColor` second program with the same color-matrix uniforms + a per-vertex color attribute. Inner-paint white × vertex-color = vertex color (multiplicative).
- `WeaselRenderer` extended to compile 5 programs (pathFill, pathFillVColor, textSdf, imageFill, gradFill); recreated on context restore.
- `setColorMatrixUniforms()` helper in `draw.ts`, transposes row-major 4×5 into a column-major mat4 + vec4 bias for upload. Called from every pathFill draw site (solid, vcolor, stencil pass-2, both stroke paths).
- Playwright `colors.spec.ts` smoke covering: 4-corner vertex-color rect, hue-rotate matrix on a red rect, composed (outer matrix + inner vertex-colors).
- Browser-verified: corner gradient interpolates RGB across the rect; red rect rotates to greenish under 120° hue matrix; composed scene applies the outer matrix to the vertex-color blend.

## Notable deviations from plan

- **Color matrix uniforms must be set on every pathFill draw, not only on the "main" path.** The pathFill shader requires a non-zero `u_colorMatrix` to render correctly. The plan only mentioned setting it in `drawPathFillSolid`; in practice the stencil pass-2 and both stroke functions also bind `ctx.pathFill` and need the uniform. Forgetting any one of them produces a black/empty output. Fixed by routing every `useProgram(pathFill)` call through `setColorMatrixUniforms()` immediately after `setSolidPaintUniforms()`.
- **Per-draw VBO for vertex colors.** The plan considered caching colored meshes; we instead upload the `a_color` buffer fresh per draw (vertex colors are command-bound, not mesh-bound). The mesh cache still keys positions/indices only — vertex colors are external state.
- **Skipped Task 8 (vertex count validation).** Defensive runtime check that `vertexColors.length / 4 === mesh.vertexCount`. Not worth the cost; bad input produces obvious wrong output. Document the invariant in the type comment instead.
- **Skipped Task 11 (context-restore round-trip for color programs).** WeaselRenderer's `loseAndRestore` path already reuses the same compile sequence; adding a colors-specific assertion duplicated coverage we get from the existing context-restore unit test.
- **`drawPathFillStencil` for non-solid paints still falls back to solid black** — that's a step-4 deferral, unchanged here. Color matrix applies to the fallback color since uniforms are now set.

## Test results

- Vitest: 145/145 pass (20 test files; new tests in `compose4x5.test.ts`, GroupState colorMatrix stack tests, and a per-vertex VBO upload test).
- Playwright: 5/5 specs pass (smoke + synthetic + text + paint + colors).
- Typecheck: clean for `packages/weasel-gl` (pre-existing rootDir noise from main `src/` imports is not step-5 related and isn't gated on this work).
- Browser-verified: all three colors smoke scenes render correctly.

## Lessons for step 6+ (folded into conventions)

- **§10 (new): every program-bound uniform that's required by the shader must be set on every draw that binds the program.** Adding a uniform to a shared shader retroactively requires auditing every `useProgram(prog)` call site. The pattern is to make a `set<X>Uniforms(prog)` helper and grep for `useProgram(prog.<name>)`; if a hit doesn't immediately precede the helper call, you have a bug.
- **§11 (new): two-pass stencil + uniform updates.** Pass 1 has color writes off, so missing uniforms are visually invisible — but pass 2 needs them. Easy to forget. The "set every uniform between `useProgram` and the *first* `drawElements`" rule from §10 catches this if pass 1 sets them; here pass 1 doesn't bother (no need), so pass 2 must.
- **Row-major 4×5 ↔ column-major mat4 transpose is fiddly.** Wrote `setColorMatrixUniforms` once, reused everywhere; avoid duplicating the transpose at call sites.

## Open follow-ups

- Per-vertex color on stroke ribbons (currently solid-only). The same `pathFillVColor` program could drive ribbon meshes; the stroke tessellator would need to emit interpolated colors per ribbon segment. Defer until a consumer needs it.
- Color matrix on text & image draws. The `textSdf` and `imageFill` shaders don't currently accept `u_colorMatrix`; tinting MSDF text or images via group color matrix is a future extension. Step 7+ when layers are ported.
- Per-vertex colors + non-identity color matrix in stencil-clipped paths. Same architectural slot as the step-4 stencil-clip + non-solid fill follow-up.
