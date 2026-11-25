# Review saturation for `dither`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 15 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Zero-area masks and placeholder GPU texture allocation | 1 | 1 | 0 |
| 2 | CPU thresholds, luma, and diffusion protection boundaries | 0 | 1 | 1 |
| 3 | Grid alignment, Bayer indexing, and shader backend parity | 0 | 1 | 2 |
| 4 | Protected rectangle projection, clipping, and mask conversion | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A zero-area protection mask still allocates a bitmap at the nonzero dimension

[createProtectTexture.ts](packages/dither/src/gpu/createProtectTexture.ts#L21) · Pass 1 · Low · Source-traced

Upload an empty mask with width 0 and a large logical height. Validation accepts zero-area masks, but the backing bitmap allocates one pixel per row despite holding no usable mask dots. It can fail at the device image-size limit even though a 1×1 placeholder would serve the shader and retain the original logical dimensions.

Source and tests were left untouched.
