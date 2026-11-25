# Review saturation for `core.interactions.actions.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 26 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Rounding thresholds through align and distribute callers | 1 | 1 | 0 |
| 2 | Transform lifecycle errors and hold teardown | 0 | 1 | 1 |
| 3 | Preview tree, overlay resolution and plane conversion | 0 | 1 | 2 |
| 4 | Action registration, selection roots and repeat memory | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Alignment can ignore a visible offset at a large world origin

[settleWithinRounding.ts](packages/core/src/interactions/actions/settleWithinRounding.ts#L8) · Pass 1 · Low · Source-traced

Align two left edges at 1000000000 and 1000000000.5. Both positions and their difference are exactly representable. The helper treats the half-unit gap as rounding because the absolute coordinate sets a one-unit tolerance. At 8× zoom the visible four-pixel misalignment remains.

Source and tests were left untouched.
