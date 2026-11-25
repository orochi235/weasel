createUploadTracker reads a tightly packed attribute as 2 floats whatever its size (A): fixed 7329ec3aef

fakeGpuDevice's getCurrentTexture keeps its first texture through resizes and frames (A): fixed d507daf5d4

glRecorder's handles and uniform locations repeat after reset() (A): fixed 70a2713340. This also corrects `draw/windowOrigin.test.ts`, which had been using the call index as the location.

Both recording Proxies answer `then`, and own-key lookups walk the prototype (A): fixed b95a42a993. `toJSON` is excluded too.

glRecorder reports `gl.canvas` and the other data properties as functions (A): fixed a86bc3bb7e

fakeGpuDevice's popErrorScope resolves null on an empty stack, and an unscoped pipeline error is dropped (A): fixed d87c7472eb

parityDevice keeps handing out a lost device and can request twice at once (A): fixed d9d788bb60. The fake device also gains `destroy`.

readGpu leaks its buffer on a mapAsync rejection, and openBackends leaks the GL renderer and context (A): fixed e7156f2965

stagedVertices drops runs drawn with the several-matrices or hull batch variants (B): fixed fa1138e488

The GL recorder's proxy answers `then`, so awaiting `gl` hangs (B): duplicate of A's `then` finding (b95a42a993)

The GL recorder lacks 9 constants the WebGL device uses, so they read as 0 (B): fixed e0048df81f. A new test reads the renderer source and fails on any `gl.CONSTANT` the table lacks.

fakeGpuDevice's getCurrentTexture ignores canvas resizes (B): duplicate of A's getCurrentTexture finding (d507daf5d4)

trimClip's vertex colors are sized for the 41-point zigzag but drawn only on the 3-anchor curve (B): fixed 86b02b8c76. The colors now ramp across each path's own anchors, for the star in wholeCases too. Its `*.browser.test.*` callers are unrun here, and the wider color range could exceed the tolerance of 3 on the fleet.

openBackends leaks a WebGL context when building either renderer throws (B): duplicate of A's readGpu/openBackends finding (e7156f2965)

No extra defects found.

Checks:
- `vertexUploads.test.ts`: pass (2)
- `glRecorder.test.ts`: pass (10)
- `fakeGpuDevice.test.ts`: pass (4)
- `recorderCtx.test.ts`: pass (1)
- `parityHarness.test.ts`: pass (4)
- `draw/windowOrigin.test.ts`: pass (1)
- Renderer weasel-ui project, all 144 files: pass after the windowOrigin fix (1124 tests)
- The 52 test files outside renderer that use the recorder: pass (363 tests)
- Unrun (browser only): `trimClip.browser.test.ts`, `trimClip.shared.browser.test.ts`, `trimClip.multisample.browser.test.ts`, and the parity browser tests that use `parityHarness`
- `npm run checks:gate`: pass, exit 0, after fixing a `typecheck:packages` failure and 5 changeset titles that `check:changesets` rejected
- `npm run lint -w @weasel-js/renderer`: does not exist, because the package has no `lint` script. Instead I ran `npx eslint` on every changed file: pass, exit 0.
- `npm run check:size`: pass
- Tree clean

tally: 11 of 14 fixed, 0 extra fixed