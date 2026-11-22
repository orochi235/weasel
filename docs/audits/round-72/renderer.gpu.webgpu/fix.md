The pipeline refusal (WebGPU's async verdict that a GPU pipeline is invalid) blanking a frame, from A+B: fixed 2ad31b5135. Until a pipeline's error scope settles, each draw with it goes in a submit of its own, so a refusal loses only that draw. The cost is two extra submits per draw with a new pipeline until its error scope settles (typically the first frame that uses it); I did not benchmark that.

Every texture laid out as a float `texture_2d` and every sampler as `filtering`, from A+B: fixed 048d0ac09a. A texture other than `texture_2d<f32>` or a sampler other than `sampler` now throws at reflection, naming the binding. A storage texture now hits the existing storage-binding error.

The id composite claiming by an unclamped color-matrix alpha, from A: fixed 606d191efb, in both the WGSL shader and its GLSL twin in `draw/idComposite.ts`. The test checks the shader source, as the color composite's test does.

`set('u_arr[i]', …)` writing only element i, from B: fixed 58457b1ec4. An element's slot now writes from that element to the array's end, as a GL element location does.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/WebGPUDevice.test.ts`: pass (22 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/wgslReflect.test.ts`: pass (29 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/draw/idComposite.test.ts`: pass (2 passed)
- Also run: `kitPrograms.test.ts` pass (50), `wgpuTargets.test.ts` pass (3), `effectPrelude.test.ts` pass (1)
- `npm run checks:gate`: pass ("all 33 passed"). The first run failed on 3 changeset titles over 140 characters and one prefer-const lint error; I fixed those into their commits.
- `npm run lint -w @weasel-js/renderer`: not run, because the package has no `lint` script ("Missing script"). The gate's root `npm run lint` passed.
- Browser tests: none touched. `refusedProgram.browser.test.ts` covers the first fix, but browser tests can't run here.
- The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed