# dither — audit round 47 findings

## GPU dither places dots in float32 from an absolute grid origin, so dot edges jitter once the grid origin is ~2^24 device px off screen
- where: packages/dither/src/gpu/frag.ts:42 (DITHER_FRAG `main`, `dotIndex = floor((px - u_gridOrigin) / u_pitch)`), also :52/:59 (tap `start`), and the WGSL twin at :105/:113/:120; origin produced by packages/dither/src/gpu/deviceGrid.ts:18 (`deviceGrid`)
- scenario: `deviceGrid` returns the grid's document origin in device pixels, `(grid.origin.x - view.x) * view.scale.x * dpr`, computed in double but uploaded as an f32 uniform and subtracted from `px` in f32 (`highp float` / `f32`). A view zoomed in on a large document far from the grid's origin — e.g. grid origin (0, 0), `view.x = 2e6`, scale 10, dpr 2 → `u_gridOrigin.x ≈ -4e7` — leaves `px - u_gridOrigin` with an ulp of 4 device px. `dotIndex` and the taps' `start` then snap in 4 px steps: dot boundaries land up to ±2 px from where they belong, dots of a 6 px pitch come out 4 or 8 px wide, taps sample the neighboring dot, and Bayer cells misalign with the CPU `ditherPixels` output of the same export. It should place each dot exactly wherever the view sits, e.g. by passing the origin reduced near the window (origin mod pitch for placement, with the integer dot offset carried separately for `u_protect` and the Bayer cell).
- evidence: read (f32 ulp arithmetic; not run)
- severity: low

## Files read
packages/dither/src/diffuse.ts
packages/dither/src/ditherPixels.ts
packages/dither/src/gpu/createProtectTexture.ts
packages/dither/src/gpu/deviceGrid.ts
packages/dither/src/gpu/dither.ts
packages/dither/src/gpu/frag.ts
packages/dither/src/gray.ts
packages/dither/src/index.ts
packages/dither/src/maskToRgba.ts
packages/dither/src/pbt.fixture.ts
packages/dither/src/protectMask.ts
packages/dither/src/protectRects.ts
packages/dither/src/shared.ts
packages/dither/src/testing/grayImage.ts
packages/dither/src/types.ts

<!-- done: 1 findings, files read: 15 -->
