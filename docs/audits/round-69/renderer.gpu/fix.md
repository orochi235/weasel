`@align`/`@size` arguments parsed with `Number`, so `16u` or a const name lays out to NaN (A) — fixed 06a5037411

`clearStencil` not reset by `beginFrame`, so another user's clear value leaks into stencil clears (A) — fixed 140b8aef6e

A refused WGSL pipeline or module is drawn with before the refusal arrives, voiding that submit (A) — not a defect (WebGPU reports the refusal only after the submit. The current design, stated in the `refusedProgram.browser.test.ts` header and in the `WebGPUDevice.test.ts` refusal test, lets the first frame go and stops drawing the program once told. Waiting on `createRenderPipelineAsync` would hold back the first draw of every valid program, kit programs included, so frame one would come out blank for every canvas.)

WebGL draws land in whatever framebuffer a mid-pass `createTarget`/`readIds`/`readCanvas` left bound (B) — fixed dd1426ff20 (`clearStencilBits` too)

A WebGL renderer opened from `canvas` has no `preserveDrawingBuffer`, so a later `readCanvas` reads a cleared buffer (B) — fixed 36bcb03d27 (the renderer now has its own copy of core's attributes, and a core test holds the two equal, because core's engine entry cannot import the renderer)

A plain-typed `var<uniform>` throws "WGSL: no struct undefined" (B) — fixed a1d47a680a (laid out as a one-member block named for the variable)

Function-scope `const`s are read as module constants and resize uniform arrays (B) — fixed 7b122f278a

A WebGPU target keeps its creation-time color view after `target.color` is replaced (B) — fixed bf6c6d391b

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/wgslReflect.test.ts`: pass (25)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgl/WebGLDevice.test.ts`: pass (24)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgl/openWebGL.test.ts`: pass (1)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/WebGPUDevice.test.ts`: pass (15)
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/contextAttributes.test.ts`: pass (1)
- These tests also make exact `bindFramebuffer` calls and still pass with the WebGL fix: `WeaselRenderer.renderIds.test.ts` (7), `drawBatch.test.ts` (60), `core/layers/effects.test.ts` (14)
- `npm run checks:gate`: pass, "checks:gate: all 33 passed" (the first run failed in gen-engine-entry; fixed by the redesign noted on the `preserveDrawingBuffer` line)
- `npm run check:changesets`: pass, "OK — 234 changeset(s)"
- `npm run lint -w packages/renderer` and `npm run lint -w packages/core`: neither package has a `lint` script (npm errors). eslint on every changed `.ts` file: pass (exit 0)
- Browser tests: none touched

tally: 7 of 8 fixed, 0 extra fixed