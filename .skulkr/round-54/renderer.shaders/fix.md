Released program keeps drawing after its release (A+B): fixed 09da0d7601

Re-registering the same source recompiles and repaints every retained surface (A): fixed f417493c53

`const int A = 2, B = 3;` records neither constant (A): fixed 1cec9c4a2a

Ramp sampled up to half a texel off (A): fixed 8c8bb2757b. All three paths now go through one `rampU` map: GLSL and WGSL `gradFill`, GLSL and WGSL batch radial/conic, and the batch's CPU linear vertices. The fix moves gradient pixels very slightly, and no browser or visual baseline ran here, so any baseline that captures a gradient may need re-blessing in the batch run.

Released program keeps drawing (B): duplicate of A's released-program finding, fixed 09da0d7601

Context restore drops a program whose re-registered source failed, instead of keeping the previous one (B): fixed 07c35510fa

`const int` list records neither constant (B): duplicate of A's const-list finding, fixed 1cec9c4a2a

Id-output rewrite counts `main` and outputs inside comments (B): fixed 2905233880. `stripComments` is now shared with the uniform scanner's `preprocess` and keeps line breaks.

Extra (sweep): `WeaselRenderer.test.ts` "deletes the program it replaces when a handle is re-registered" pinned the redundant recompile. It now checks that a same-source re-register deletes nothing and a replaced source deletes one. This was folded into f417493c53.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `shaders/CustomPrograms.test.ts` 7/7
  - `shaders/extractUniformNames.test.ts` 20/20
  - `shaders/idOutput.test.ts` 8/8
  - `shaders/batchFill.test.ts` 18/18
  - `cache/rampCoordinate.test.ts` (new) 3/3
  - `drawBatch.test.ts` 60/60
  - `drawGradient.units.test.ts` 16/16
  - `WeaselRenderer.test.ts` 21/21
- Whole `packages/renderer`: 1557/1557 pass.
- `npm run checks:gate`: "all 32 passed".
- `npm run lint -w @weasel-js/renderer`: unrun, because the package has no `lint` script. eslint on every changed `.ts` file passes.
- Browser and visual tests: unrun here.
- Tree clean, `.skulk/` untouched.

tally: 6 of 8 fixed, 1 extra fixed