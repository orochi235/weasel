# Review saturation for `pdf`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 28 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Image source placement and gradient transparency parity | 2 | 2 | 0 |
| 2 | Group raster ordering, clipping, and graphics state rollback | 0 | 2 | 1 |
| 3 | Glyph embedding, Unicode mapping, and text fallback | 0 | 2 | 2 |
| 4 | Stroke and path emission, object serialization, and export framing | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. PDF image crops leave out-of-bounds source areas blank

[images.ts](packages/pdf/src/images.ts#L157) · Pass 1 · P2 · Source-traced

Draw a two-pixel opaque image using a source rectangle that starts at x=-1 and is two pixels wide. The renderer clamps sampling to the first texel outside the bitmap, so the destination remains painted. The PDF writer places the finite bitmap inside a destination clip without extending its edges, leaving the portion corresponding to negative source x blank. The same problem affects atlas sprites with out-of-range source rectangles.

### 2. Transparent gradient stops change PDF hue as they fade

[shading.ts](packages/pdf/src/shading.ts#L60) · Pass 1 · P2 · Source-traced

Export an RGB gradient from opaque red to transparent blue. The renderer's premultiplied stop interpolation keeps red throughout the fade. PDF constructs a straight DeviceRGB ramp from red to blue plus an independent opacity mask. At the midpoint the ramp is purple at half opacity, so the exported gradient adds blue where the scene has none.

Source and tests were left untouched.
