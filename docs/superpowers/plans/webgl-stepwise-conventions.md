# WebGL Transition — Stepwise Conventions

**REQUIRED READING for every step plan.** This doc captures lessons accumulated across steps that don't belong in any one done-note. Each entry has a "where it bites" line so the relevant step-plan author knows which task to bake the precaution into.

This doc is updated at the end of every step (alongside the per-step done note). New lessons append; existing entries are tightened only if they turn out to be wrong or incomplete.

---

## 1. Browser context defaults are *not* surfaced by the mock GL recorder

**Status:** confirmed in step 1.
**Where it bites:** any feature that depends on a non-default `getContext` attribute (stencil, depth, antialias, premultipliedAlpha, preserveDrawingBuffer).

`makeGLRecorder()` in `packages/weasel-gl/test-utils/glRecorder.ts` records *method calls*, not the context attributes the canvas was created with. If the renderer relies on `{ stencil: true }` (e.g. for any two-pass mask) or `{ alpha: true }` (the default) or any other context option, the unit tests pass while the real-browser output is wrong.

**Required:** any feature whose correctness depends on a context option needs a **Playwright smoke test that reads pixels back from a real browser**. A unit test of GL call sequence is necessary but not sufficient.

Step 1 caught this: the stencil two-pass for evenodd was unit-tested green but produced a solid filled square in the browser because `getContext('webgl2')` defaults to `stencil: false`.

---

## 2. Browser default `premultipliedAlpha: true` requires premultiplied shader output

**Status:** confirmed in step 1.
**Where it bites:** any new fragment shader that writes a color with alpha < 1.

The browser composites the canvas over the page background expecting **premultiplied** RGB (RGB pre-multiplied by alpha). If the shader outputs `vec4(rgb, a)` with straight alpha and `rgb > a`, the composition over the page produces incorrect (too-bright) results — translucent fills look fully opaque. The renderer also uses `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` to match.

**Required:** every fragment shader in `packages/weasel-gl/src/shaders/` outputs `vec4(rgb * a, a)`, where `a` is the effective alpha (color alpha × group alpha). Document this in a top-of-file comment for every new shader.

The path-fill shader (step 1) and stroke (step 2, which reuses path-fill) follow this. Future shaders (text/SDF in step 3, gradient in step 4, custom shader API in step 6) must too.

---

## 3. `npm install --save` doesn't pin exact versions

**Status:** confirmed in step 1 (earcut landed as `^2.2.4`, had to be re-pinned).
**Where it bites:** any step that adds a new npm dependency.

`npm install pkg` adds `^pkg@vX.Y.Z` (caret range). For libraries we want frozen, use `npm install --save-exact pkg`.

**Required:** when adding any dep in a step plan, use `npm install --save-exact` and verify with `cat package.json | grep <pkg>` that no `^` or `~` prefix landed.

---

## 4. Vitest needs the same path aliases as Vite

**Status:** confirmed in step 1.
**Where it bites:** any step that adds a new workspace package whose tests import from another workspace package using the `@scope/name` alias.

Vitest uses its own config (`vitest.config.ts`), separate from the project's main `vite.config.ts`. If `@orochi235/weasel` has a `resolve.alias` in `vite.config.ts`, that alias must be mirrored in `vitest.config.ts` for any vitest test that imports a *value* (not just a type) from that path.

**Required:** when adding a new workspace package's first vitest test, include at least one runtime *value* import from `@orochi235/weasel` (or whatever cross-workspace path is used). Type-only imports get stripped at runtime and won't fail-fast on missing aliases.

---

## 5. Vite 8 dropped the `--root` CLI flag

**Status:** confirmed in step 1.
**Where it bites:** any step that adds a new dev page that needs to serve from outside the main `vite.config.ts` root.

`vite --root .` errors with "Unknown option `--root`" in vite ≥ 8. Use a per-page `vite.config.ts` instead (see `packages/weasel-gl/dev/vite.config.ts` from step 1).

---

## 6. Playwright pixel readback requires `preserveDrawingBuffer: true`

**Status:** confirmed in step 1.
**Where it bites:** any new Playwright smoke spec that calls `gl.readPixels` after `r.render()`.

The browser clears the WebGL drawing buffer between paint and the next event loop tick. Without `preserveDrawingBuffer: true`, `readPixels` after the render returns zeros.

**Required:** dev pages that are targets of Playwright smoke tests must call `canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })` and pass the resulting context as `gl` to `WeaselRenderer`.

This is a *test-only* concern — real consumers don't need (and shouldn't pay the perf cost of) `preserveDrawingBuffer`.

---

## 7. Granularity recommendation: inline simple verbatim tasks

**Status:** confirmed in step 1 execution.
**Where it bites:** every step that delegates implementation to subagents.

Step 1 had 28 plan tasks. Dispatching a subagent for each one — including pure verbatim "write this 6-line type definition" tasks — wasted ~60s of dispatch overhead per task for ~5s of actual work. The user explicitly noted this slowness.

**Recommendation for the controller (Claude in subagent-driven-development):** use subagents for tasks with judgment (renderer dispatch logic, stencil two-pass, smoke setup). Inline-execute tasks that are pure verbatim copy-from-plan (type definitions, simple test+impl pairs where the code is fully spelled out in the plan). The skill's "fresh subagent per task" rule is meant to avoid context pollution; for verbatim copies, no pollution exists since the code IS in the controller's prompt context already.

**Estimated split for future steps:** 60–70% inline, 30–40% subagent.

---

## 8. Mock GL recorder doesn't catch geometry coverage bugs

**Status:** confirmed in step 2.
**Where it bites:** any feature that emits triangles whose *shape* matters for visual correctness — joins, fans, masks, geometry-based effects.

The recorder catches "the right `drawElements` count was issued" and "the right uniforms were set." It does NOT catch:
- Triangles whose vertices are in the wrong positions
- Triangles with wrong winding order (visible only with face-culling enabled, but still wrong semantically)
- Missing triangles (e.g. emitting one when two were needed to fill a quadrilateral)
- Triangles drawn but covering the wrong area (e.g. inverted sweep direction on a fan)

Step 2 caught two such bugs in the planned miter and round join code — both passed all unit tests but failed visually:
- Miter emitted only the outer-extension triangle, missing the inner bevel half → inverted-triangle gap at every corner.
- Round-join arc swept the long 270° way instead of the short 90° outer-wedge arc.

**Required:** any task whose correctness depends on the *shape* (not just the count) of emitted geometry must be verified visually via Playwright smoke. Unit tests should additionally check **vertex positions** for at least one case (e.g. `expect(Array.from(mesh.vertices)).toEqual([...])` on a known-coordinate input), not just lengths.

**Plan-time treatment:** plan pseudocode for geometry tasks is a starting sketch, not a verbatim spec. The implementer derives the math from first principles, then cross-checks against the plan. Bugs in plan-pseudocode that pass naive unit tests are routine.

---

## 9. Don't track per-renderer state on shared registry entries

**Status:** confirmed in step 3.
**Where it bites:** any module-level registry whose entries reference resources owned by per-renderer caches.

Step 3's first attempt at `registerFont` stored a `textureUploaded: boolean` flag on each `FontEntry`. The intent was to skip re-uploading the atlas on subsequent draws. But each `WeaselRenderer` has its own `GLTextureCache`, so the first renderer set the flag → second renderer's `ensureFontTexture` saw "already uploaded" and skipped → its own texture cache was empty → `bind()` threw at draw time.

**Required:** when a module-level registry holds resources that get consumed by per-renderer caches, the dedup must live in the cache's own state, not on the registry entry. Make `cache.upload(id, …)` idempotent (check `has(id)` first) and have callers always invoke `upload` rather than guarding behind a registry-side flag.

This generalizes: any module-level singleton that supplies resources to per-instance objects must not assume one consumer. Even single-canvas apps re-create renderers (context loss, hot-reload, etc.), so the assumption breaks across time as well as across instances.

---

## Updates from step 3

**§1 (browser context defaults):** smoke-test sample pattern matters. Diagonal sampling worked for full-canvas scenes (steps 1–2) but missed the text region in step 3 (text occupies a narrow horizontal strip). Default to **grid sampling** (e.g. 16×16 cell centers) for any future smoke spec; reserve diagonal for scenes that genuinely cover the canvas.

**§3 (`--save-exact`):** plan-time version pinning is risky. The step-3 plan specified `msdf-bmfont-xml@6.0.0` which doesn't exist on npm; latest stable is 2.8.0. **Required:** when adding a new dep, run `npm view <pkg> versions --json | tail` first, then pin the actual latest. Same applies to plan-time CLI flag specs — run `<tool> --help` before writing the wrapper script.

---

## 10. Required uniforms must be set on every draw that binds the program

**Status:** confirmed in step 5.
**Where it bites:** any step that retroactively adds a required uniform to a shared shader program.

Step 5 added `u_colorMatrix` + `u_colorBias` to the existing `pathFill` shader. The plan only mentioned setting them in `drawPathFillSolid` (the "main" path). In practice, `pathFill` is bound from four different functions: `drawPathFillSolid`, `drawPathFillStencil` (pass 2), `drawPathStrokeUnclipped`, and `drawPathStrokeStenciled` (pass 2). Forgetting any one site → that site reads a zero matrix → renders black or empty. Pass-1 of stencil paths has color writes off, so the missing uniform is invisible there but bites pass 2.

**Required:** when adding a uniform to a shared shader, audit every `useProgram(prog)` call site. The pattern is to wrap the binding in a `set<X>Uniforms(prog)` helper and grep-verify that every `useProgram(prog)` call is followed by every required `set<X>Uniforms` helper before the *first* `drawElements` that emits color-writing pixels.

A unit test of "renderer issues `uniformMatrix4fv` for u_colorMatrix" only catches the *first* call site; the recorder is happy if any one place sets it. Visual smoke (Playwright pixel readback) is what catches the missing call sites.

---

## 11. Two-pass stencil paths defer uniform setup to pass 2

**Status:** confirmed in step 5.
**Where it bites:** any new uniform on a shader bound by an existing two-pass stencil path.

The stencil mask pass (pass 1) has `colorMask(false, …)` so the fragment shader's color output doesn't matter — uniforms can be unset. Pass 2 turns color writes on and needs every required uniform configured. Easy to forget to set them between passes because pass 1 looks like it's "already drawing" with the program bound.

**Required:** in two-pass stencil functions, set color/paint/matrix uniforms **immediately before pass 2's `drawElements`**, not at the top of the function. This makes the requirement local and visible at the line that needs it. See `drawPathFillStencil` and `drawPathStrokeStenciled` in `draw.ts` for the canonical layout.

---

## 12. Module-level registries store data, not GL resources

**Status:** confirmed in step 6 (third instance after `registerFont` in step 3 and `registerTexture` in step 6).
**Where it bites:** any future "register X" public API.

`registerFont` stores font metrics + `ImageBitmap`. `registerTexture` stores `HTMLImageElement | ImageBitmap`. `registerProgram` stores GLSL source strings. **None** of these touch GL — actual upload / compile happens lazily when a `WeaselRenderer` consumes the registered data. This is the analog of convention §9 enforced at the registration step: module-level state is GL-context-agnostic; per-renderer caches do the dedup and own the GL handles.

**Required:** new `registerX(...)` public APIs follow this pattern. Returns an opaque handle (`{ id }`); the actual GL work is on `WeaselRenderer.registerX(handle)` or implicit at draw time via a per-renderer cache.

This decouples the public surface from the GL context lifecycle. Multiple renderers can consume the same registered data; context restore re-compiles / re-uploads transparently.

---

## 13. Consumer-facing GLSL contracts must document premultiplied alpha loudly

**Status:** confirmed in step 6.
**Where it bites:** any future API that lets consumers write GLSL the kit dispatches.

§2 establishes that all kit-internal shaders output premultiplied alpha. Once consumers can write their own fragments (step 6 onward), the kit can't enforce this — only document it. Step 6 documents the requirement in **three** places: the `registerProgram` JSDoc `@remarks`, the vertex prelude header comment (visible to consumers reading the source), and the demo fragment shader's inline comment. Anything less risks consumers writing `vec4(rgb, a)` and getting over-bright translucent fragments while opaque output looks correct (so the bug only surfaces with `a < 1`).

**Required:** future consumer-GLSL APIs (custom vertex shaders, post-process passes, etc.) maintain at least the JSDoc + header-comment double-warning. Inline shader-source comments in the canonical demo are the third reinforcement — easy to overlook but high value when consumers copy-paste the demo.

---

## How to update this doc

Each per-step done note adds new lessons. At the end of each step, the controller folds applicable new lessons into the relevant section above and adds a new section if the lesson doesn't fit existing categories. Update the **Status** date and **Where it bites** line to keep entries scannable.

When writing the next step plan, the plan's header MUST cite this doc and bake any directly-applicable convention into the relevant task's instructions inline, not just by reference.
