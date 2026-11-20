- **The GPU dither loses its dot grid far from the grid origin, because the origin reaches the shader as an unreduced float32 (A+B)**: fixed fff9a7ab63. `dither` now moves the origin by whole 4-dot Bayer cells in float64, so it lands within one cell of the buffer. The dots it moved go to the shader as a new `u_dotOffset` uniform (GLSL and WGSL), which is added back only for the protect-mask lookup. That offset is clamped to ±2^23, beyond which no protect mask can reach the buffer. The test copies the shader's float32 arithmetic with `Math.fround` and failed before the fix.
- **`ditherPixels` returns `undefined` for an unknown method, and `dither` calls an unknown method error diffusion (B)**: fixed 4c137518a5. Both now throw a `RangeError` naming the methods they take, and `dither` keeps its CPU-only message for `'floyd-steinberg'` and `'atkinson'` only.

No extra defects found while fixing. Nothing added to `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 packages/dither/src/gpu/dither.test.ts`: pass (11/11)
- `npx vitest run --maxWorkers=1 packages/dither/src/ditherPixels.test.ts`: pass (9/9)
- `packages/dither/src/gpu/dither.browser.test.ts`: unrun (browser test, not touched, but it exercises the changed shader)
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("all 32 passed", root typecheck included)
- `npm run lint -w @weasel-js/dither`: the package has no lint script. `npx eslint packages/dither/src`: pass
- Tree clean; two commits on top of e1a7ae4e1f.