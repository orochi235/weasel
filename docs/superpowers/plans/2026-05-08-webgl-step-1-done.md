# WebGL Step 1 — Done

**Plan:** [`2026-05-08-webgl-step-1-solid-fill-paths.md`](./2026-05-08-webgl-step-1-solid-fill-paths.md)
**Date completed:** 2026-05-08

## What shipped

- `@orochi235/weasel-gl` workspace package wired into `tsconfig.json` (`packages/weasel-gl/`).
- Path tessellator: earcut for nonzero (single + multi-contour with holes); naive fan + `requiresStencil` flag for evenodd. Reuses existing `flattenCubic`/`flattenQuadratic` from `@orochi235/weasel`.
- WeakMap path-mesh cache (per Path identity).
- `mat3` 2D affine helpers (column-major, GL-ready uniform layout).
- `WeaselRenderer` class: WebGL2 context lifecycle, DPR-aware viewport, `resize()`, `webglcontextlost`/`webglcontextrestored` handlers (re-runs init + re-creates path-fill program + mesh cache).
- Solid-fill path GLSL shader + `ShaderProgram` compile/link/lookup wrapper.
- `GLMeshCache` (per-Mesh-identity VBO/IBO/VAO upload).
- `GroupState` software push/pop transform + alpha stack.
- DrawCommand interpreter for `kind: 'group'` (transform + alpha) and `kind: 'path'` (solid `Paint`, both fillRules).
- Stencil two-pass for evenodd paths (color-mask off → INVERT stencil → color-mask on → NOTEQUAL → clear stencil).
- CSS color string parser (`#rgb`/`#rrggbb`/`#rrggbbaa`/`rgb()`/`rgba()`).
- Public barrel exports.
- Playwright smoke test (real Chromium): two-rect smoke + four-canvas synthetic scene smoke (10/100/1000 polygons + evenodd ring).

## Notable deviations from plan

- **Two extra commits beyond the plan's 28 tasks:**
  - `vitest.config.ts` needed an `@orochi235/weasel` alias mirroring `vite.config.ts` — Task 1's plan didn't anticipate this; only became visible when Task 6 first imported a *value* (vs. Task 5's type-only import). Fixed as a follow-on commit during Task 6.
  - `packages/weasel-gl/dev/vite.config.ts` — separate vite config for serving the smoke page from repo root (the project's main `vite.config.ts` has `root: 'demo'`). Vite 8 dropped the `--root` CLI flag, so a config file was required.
- **Plan's `npm install --save` left caret ranges** on earcut — the plan's intent ("pin patch versions") translated to `^2.2.4` not `2.2.4`. Fixed in a follow-on commit by editing `package.json` and reinstalling.
- **Smoke `smoke.ts` uses `getContext('webgl2', { preserveDrawingBuffer: true })`** explicitly — Chromium clears the drawing buffer between paint and `readPixels` otherwise, and the smoke test reads pixels well after the render. Not a real-consumer concern; documented inline.
- **Synthetic scene verification is automated**, not manual — added `synthetic.spec.ts` that reads a 16-pixel grid per canvas and asserts at least one painted sample. The plan called for manual eyeball; automated check covers the same exit criterion (every scene paints) without requiring a human in the loop. Manual eyeball still recommended once before declaring step done.

## Test results

- Vitest: 1332/1332 tests pass (existing weasel + new weasel-gl).
- Playwright: 2/2 smoke specs pass against headless Chromium (`smoke.spec.ts` + `synthetic.spec.ts`).
- Typecheck: clean.

## Lessons for step 2 (strokes)

- **Verify value-import resolution early.** Tasks 1–5 used type-only imports from `@orochi235/weasel`, which got stripped at runtime and masked a missing vitest alias. First runtime value import in Task 6 surfaced it. For step 2 onward: include at least one value import in any new package's first test file even if not strictly needed, to fail fast.
- **`npm install` doesn't pin by default.** `--save-exact` is required to drop the caret. Worth adding to step 2's plan when new deps land.
- **Vite 8 CLI surface narrowed.** `--root` is gone; either a config file or rely on cwd. Step 2 won't add a new dev page, but step 3 (text) will when the MSDF-atlas viewer ships.
- **Browser-context drawing buffer behavior.** Any future Playwright test that reads pixels back must use `preserveDrawingBuffer: true` *or* read inside the same animation frame as the render. Document in the visual regression rig design (step 9).

## Open follow-ups

None blocking step 2. The `kind: 'shader'` variant in the type union is unreachable from consumer code (intentional — the `registerProgram` API arrives in step 6). The `colorMatrix` group attribute in the spec's final `DrawCommand` shape isn't exposed yet either (lands in step 5).
