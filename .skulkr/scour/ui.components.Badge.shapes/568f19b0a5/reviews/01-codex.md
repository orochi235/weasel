# Review saturation for `ui.components.Badge.shapes`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 24 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Focus paths, fill and stroke gates, and SVG masks | 1 | 1 | 0 |
| 2 | Repeat counts, numeric defaults, and outline boundaries | 0 | 1 | 1 |
| 3 | Polygon presets and clamped shape transitions | 0 | 1 | 2 |
| 4 | Shape-to-base parameter mapping, insets, and registry coverage | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The perforated badge clips away its focus ring

[Perforated.tsx](packages/ui/src/components/Badge/shapes/Perforated.tsx#L64) · Pass 1 · Medium · Source-traced

The focus rectangle sits four viewBox units outside the body on every side, but it uses the same mask as the body. The mask paints white only inside the body and paints holes black within that area. With ordinary badge dimensions and stroke widths the exterior focus stroke is entirely outside the white area, so keyboard focus can become invisible on a perforated badge. The focus treatment should remain visible outside the body.

Source and tests were left untouched.
