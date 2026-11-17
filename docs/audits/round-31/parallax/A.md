## A tiled layer whose one axis is empty still walks every copy index of the other, so a negative bleed can spin the draw for up to 2^53 iterations
- where: packages/parallax/src/createTiledLayer.ts:98 (createTiledLayer draw, the `tiling` guard and the `i`/`j` loops at 116–117)
- scenario: `bleed: { y: -1000 }` (content inset from its cell) on a view shorter than 2000 world units makes `tiledProject` answer `ky.to < ky.from`, so `(ky.to - ky.from + 1)` is 0 or negative and the product is ≤ `MAX_COPIES` whatever `kx` holds. Zoom out on x with a small `period.x` (e.g. `period: { x: 1, y: 100 }`, `view.scale.x = 1e-9`): `kx` spans ~1e12 safe integers, `tiling` is true, and the outer `for (i …)` runs that many times with an empty inner loop, freezing the frame, where it should draw nothing at once. The guard needs each axis's count clamped at 0 (or an early return when either range is empty) before multiplying.
- evidence: read
- severity: medium

## `plane.set({ pan: undefined })` is accepted and makes every later draw of the plane throw
- where: packages/parallax/src/createParallaxPlane.ts:26 (createParallaxPlane `set`)
- scenario: `Partial<ParallaxOptions>` with `exactOptionalPropertyTypes` off (the repo default) types `pan` as `ScalarOrXY | undefined`, so `plane.set({ pan: maybePan })` compiles. `{ ...current, ...patch }` writes `pan: undefined` over the required pan, `sameOpts` sees a change and notifies, and `deriveParallaxView` then reads `asXY(undefined).x` and throws a TypeError on every frame. The parallax layer's outer `drawOneLayer` catches it, so the whole plane silently paints nothing until another `set` restores `pan`. An `undefined` in the patch should mean "leave this key" (or be rejected) rather than erase a required field.
- evidence: read
- severity: low

## Files read
packages/parallax/src/createParallaxLayer.ts
packages/parallax/src/createParallaxPlane.ts
packages/parallax/src/createTiledLayer.ts
packages/parallax/src/index.ts
packages/parallax/src/pbt.fixture.ts
packages/parallax/src/tiledProject.ts

<!-- done: 2 findings, files read: 6 -->
