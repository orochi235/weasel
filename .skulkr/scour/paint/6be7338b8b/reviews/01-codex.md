# Review saturation for `paint`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 34 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Color editing and preview behavior across public entry points | 2 | 2 | 0 |
| 2 | Stroke defaults, dash phases, trim and cache identity | 0 | 2 | 1 |
| 3 | Interpolation, gamut conversion and palette resolution | 0 | 2 | 2 |
| 4 | Pattern transforms, paint-kind guards and fixture coverage | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Gradient previews blur authored hard stops

[paintPreview.ts](packages/paint/src/paintPreview.ts#L75) · Pass 1 · P3 · Source-traced

Use red at offsets 0 and 0.5 and blue at offsets 0.5 and 1. sampleResolvedStops switches directly from red to blue at 0.5. The CSS preview emits red at 45.8 percent and blue at 50 percent, with no coincident stop to encode the jump. The browser blends across that interval, adding colors absent from the authored gradient.

### 2. Alpha replacement can turn a malformed hex string into a valid color

[hexAlpha.ts](packages/paint/src/hexAlpha.ts#L30) · Pass 1 · P3 · Source-traced

Call withAlpha01 with #abcdefzz and 0.5. toHex8 passes the malformed input through, but withAlpha01 accepts it based on its prefix and length and returns #abcdef80. The documented pass-through would preserve the input. mergeAlphaFromPrev also reaches this path after its validation of the picked color fails.

Source and tests were left untouched.
