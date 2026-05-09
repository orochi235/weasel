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

## How to update this doc

Each per-step done note adds new lessons. At the end of each step, the controller folds applicable new lessons into the relevant section above and adds a new section if the lesson doesn't fit existing categories. Update the **Status** date and **Where it bites** line to keep entries scannable.

When writing the next step plan, the plan's header MUST cite this doc and bake any directly-applicable convention into the relevant task's instructions inline, not just by reference.
