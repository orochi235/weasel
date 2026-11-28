# Review saturation for `stroke`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 31 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Stroke-edge queries versus visible stroke spans | 1 | 1 | 0 |
| 2 | Screen metric construction at finite extreme scales | 1 | 2 | 0 |
| 3 | Dash stepping and absolute tolerances | 1 | 3 | 0 |
| 4 | Marker placement, sizing and registry reads | 0 | 3 | 1 |
| 5 | Ribbon expansion, inset trimming and patch geometry | 0 | 3 | 2 |
| 6 | Outline conversion, offset paths and public exports | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Stroke-edge queries still report ink outside the trimmed span

[strokeEdge.ts](packages/stroke/src/strokeEdge.ts#L72) · Pass 1 · Medium · Source-traced

The query flattens and measures the full path without applying stroke.trim. It reports a nearby edge on an excluded section and even returns an edge when the entire trim window draws nothing. This also affects a width handle that uses this query to locate visible ink.

### 2. Stroke metrics can become non-finite from finite coefficients

[metric.ts](packages/stroke/src/tessellate/metric.ts#L69) · Pass 2 · Low · Source-traced

The determinant can be finite for a highly anisotropic matrix even when squaring its larger coefficient overflows. The normalized matrix calculation then divides infinity by infinity and passes a NaN coefficient into coordinate transforms. Conversely a uniformly large finite similarity can overflow the determinant and be reported singular.

### 3. A small dashed segment can be treated as one coincident point

[dash.ts](packages/stroke/src/tessellate/dash.ts#L166) · Pass 3 · Low · Source-traced

The dash budget is based on the ratio of path length to pattern length, so scaling both together preserves the number of runs. The splitter still skips dash traversal for any segment at most 1e-9 units long and extends the current run across it. A short path with a proportionally short valid pattern can therefore lose its gaps.

Source and tests were left untouched.
