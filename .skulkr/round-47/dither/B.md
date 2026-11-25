# Audit round 47 — dither (blind reviewer)

## The live dither loses its dot grid far from the grid origin: `u_gridOrigin` reaches the shader as an unreduced float32
- where: packages/dither/src/gpu/deviceGrid.ts:18 (deviceGrid), packages/dither/src/gpu/dither.ts:60 (dither), packages/dither/src/gpu/frag.ts:42,52,105,113 (main / effect)
- scenario: `deviceGrid` answers the origin as `(grid.origin − view.x) · sx` in device pixels. That number grows with the distance between the view and the grid origin, and `dither` passes it to the shader as is. Then the shader works out `dotIndex = floor((px − u_gridOrigin) / u_pitch)` and the tap start `u_gridOrigin + dotIndex · u_pitch` in float32. Take a 180 dpi grid at the document origin (pitch 0.4 pt), a view at x = 2·10⁶ pt, zoom 4 and dpr 2 (8 device px/pt). The origin is −1.6·10⁷ device px, where float32's step is 1–2 px. The pitch is 3.2 device px, so dot boundaries move by a pixel or more. Dots come out 2 or 4 pixels wide instead of 3–4, their taps land on the wrong pixels, and the Bayer cell (`dotIndex mod 4`) can be off. So the preview stops matching the export, which computes in float64 from the image's own pixels. Expected: the grid stays exact at any distance. Bayer needs only `dotIndex mod 4`, so the origin can be reduced in float64 on the CPU to within `4·pitch` of the buffer, with the protect mask's dot offset passed separately as a small integer. That keeps every number the shader handles small.
- evidence: read
- severity: medium

## `ditherPixels` returns `undefined` for a method it doesn't know, while `dither` throws for the same input, with a message that calls it error diffusion
- where: packages/dither/src/ditherPixels.ts:20-41 (ditherPixels), packages/dither/src/gpu/dither.ts:40-42 (dither)
- scenario: A JS caller, or a method read from saved prefs or a URL, passes `{ method: 'ordered' }`. `ditherPixels` checks sizes, takes the gray, then falls out of the `switch` with no `default`. It returns `undefined` where its signature promises a `Uint8Array`, and the caller crashes later, somewhere unrelated (for example in `maskToRgba`'s `mask.length`). `dither({ method: 'ordered' })` throws instead, but says "'ordered' is error diffusion, which runs on the CPU only (ditherPixels)", which is false. Handing the method to `ditherPixels` as that message suggests then gives `undefined`. So one decision gets two different answers, and the message misdirects. Expected: both reject an unknown method with a message naming the valid ones, and `dither` gives the error-diffusion hint only for `'floyd-steinberg'` and `'atkinson'`.
- evidence: read
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

<!-- done: 2 findings, files read: 15 -->
