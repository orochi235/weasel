# Where small atlas glyphs lost ink, 2026-10-31

The measurements behind retiring the `docs/TODO.md` entry "Area coverage for small atlas glyphs: what is left".
Taken on teitou (Apple M5 Max, ANGLE Metal, headless Chromium) with the probe in `probe/`, which renders the
`H` of `glyphCoverage.browser.test.ts` at 7.2, 12, and 16px, `x` stepping through a pixel in sixteenths, and
prints its red channel (32x24) one JSON line per render.

**Cause: the 4x multisampled target clipped pixels at the glyph quad's edge.** The quad was the glyph's atlas
cell, whose padding is 2 texels, 0.45px at 7.2px. Area coverage inks a pixel up to half a pixel past the
outline, and a pixel the quad's edge crossed was scaled by the share of its samples inside the quad. A CPU
model of the shader (`model/glyphmodel.mjs`) reproduces the GPU's pixels only with that sample clipping in:

| 7.2px `H`, `x` in eighths     | centroid swing | ink mass    |
|-------------------------------|---------------:|-------------|
| GPU, before (`before.jsonl`)  |          0.374 | 7.82 – 8.64 |
| model, no MSAA                |          0.117 | 8.26 – 8.86 |
| model, 4x MSAA                |          0.402 | 7.84 – 8.65 |
| model, MSAA, quad grown 1px   |          0.117 | 8.46 – 8.86 |
| GPU, quad grown 1px (`grown.jsonl`) |    0.103 | 8.42 – 8.84 |

Model figures step `x` in sixteenths; the GPU rows read every other one, as the test does.

Ruled out with the shader variants in `variant-*.jsonl` (`probe/variants.sh.txt` swaps each into
`textSdf.ts`): `tap0` (one tap through the ramp) matches the model pixel for pixel (summed squared error
0.066 over 16 renders), so sampling, quad placement, and the field threshold are as modeled; `grid16`, a 4x4
grid of taps, swung 0.356 on the GPU against 0.084 in the model without MSAA, and fits the model with MSAA
(error 0.084 against 0.506 without). Tap pattern, bilinear weight precision (`fracBits`), texel snapping, and
`GLYPH_AREA_FROM` were not it.

- `model/sweep.mjs <size> '<opts json>' <quad top>`: the model's swing and mass; `<quad top>` 5.3125 is the
  fitted one for 7.2px. `model/gpusweep.mjs <jsonl>...`: the same read off GPU renders.
  `F=<jsonl> model/fitscale.mjs '<opts list>'`: the model's squared error against GPU renders.
- `probe*.job.log`: the onto jobs' output, probe lines stripped.
- `probe/`: the probe test and runners, as `.txt` so no project collects them. To rerun, put the test at
  `packages/core/src/canvas/glyphProbe.browser.test.ts` and run `run.sh` on a node with it as the argument.
