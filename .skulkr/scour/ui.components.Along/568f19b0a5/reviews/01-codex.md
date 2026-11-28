# Review saturation for `ui.components.Along`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 47 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Curved label shaping, measurement, and placement | 1 | 1 | 0 |
| 2 | Run slot identity, observer lifetime, and layout updates | 0 | 1 | 1 |
| 3 | Scroll projection, input gestures, and focus reveal | 0 | 1 | 2 |
| 4 | Arc geometry, bent text lifecycle, and lab controls | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Curved label spacing accumulates per-span rounding error

[CurvedLabel.tsx](packages/ui/src/components/Along/CurvedLabel.tsx#L47) · Pass 1 · Low · Source-traced

Each grapheme span is placed using its integer `offsetWidth`, although its CSS layout width can be fractional. The placement advances by those rounded widths individually. For a repeated grapheme whose actual advance is 7.4px, the layout allocates 7px per span, accumulating 0.4px of lost spacing for each one. Text can look crowded and occupy a shorter arc than its measured font advances imply. This was traced through the placement inputs without a browser measurement.

Source and tests were left untouched.
