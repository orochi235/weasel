- WebGPU draw binds a texture freed since a program set it, which voids the submit (A): fixed c27d565c60
- WebGPU `createTarget` makes the multisampled color, stencil, and resolve textures at 0 size while the color is clamped to 1×1 (A+B): fixed 0cb4638e8e
- WebGL draw rebinds the pass's own target color or ids and hits a feedback loop, where WebGPU binds its dummy (A): fixed 18ae591bd4
- WGSL `@group`, `@binding`, and `@location` read only as bare decimals, so one given by a const is dropped from the layout (A): fixed d433ee63c7
- `beginFrame` leaves sampler objects another user of the context bound (A): fixed 64ab150d21
- A lost WebGL context is reported and cached as a shader compile failure (B): fixed 9a35a95071
- WebGPU canvas pass on a 0-sized canvas copies into an invalid current texture (B): fixed 92858d1a02

Extra defects: none. While fixing the lost-context finding, `WeaselRenderer.test.ts`'s mid-construction listener test had been faking a failed constructor with a lost context. It now uses a real compile failure instead; the change is in 9a35a95071.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgl/GlProgram.test.ts`: pass (12 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgl/WebGLDevice.test.ts`: pass (26 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/WebGPUDevice.test.ts`: pass (18 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/wgslReflect.test.ts`: pass (28 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/WeaselRenderer.test.ts`: pass (21 passed)
- Also run, untouched: `kitPrograms.test.ts` pass (50 passed), `paintPrelude.test.ts` pass (4 passed), `WeaselRenderer.paintResources.test.ts` pass (4 passed)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass ("OK — 301 changeset(s)")
- `npm run lint -w @weasel-js/renderer`: not run, because `@weasel-js/renderer` has no `lint` script ("Missing script: lint"). I ran eslint on every changed `.ts` file instead: pass. The gate's root `npm run lint` also passed.
- Browser tests: none touched.

tally: 7 of 7 fixed, 0 extra fixed