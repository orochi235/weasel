# Review saturation for `scale`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Continuous forward and inverse arithmetic | 1 | 1 | 0 |
| 2 | Tick grid precision and bounds | 1 | 2 | 0 |
| 3 | Logarithmic tick construction work | 1 | 3 | 0 |
| 4 | Calendar alignment and time label precision | 0 | 3 | 1 |
| 5 | Categorical and polar position conventions | 0 | 3 | 2 |
| 6 | Warped tick rounding and formatter overrides | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Inverse mapping loses position on a wide finite output range

[linear.ts](packages/scale/src/linear.ts#L170) · Pass 1 · Medium · Source-traced

Forward interpolation can span opposite-sign finite extremes without overflowing, but inverse mapping divides by the raw range difference. When that difference overflows, the midpoint maps back to the first domain value and the far endpoint can yield NaN. The same raw difference is used by time, warp and log inversion.

### 2. Explicit fractional tick steps can return values off their grid

[linear.ts](packages/scale/src/linear.ts#L72) · Pass 2 · Medium · Source-traced

onGrid decides the number of decimal places from the step's order of magnitude. With step 0.25 it keeps one decimal place, so a tick at 0.75 becomes 0.8. stepTicks then returns values outside its documented multiples, potentially beyond the requested bounds.

### 3. Log scale construction enumerates every power to test whether two exist

[log.ts](packages/scale/src/log.ts#L59) · Pass 3 · Medium · Source-traced

The constructor asks powerTicks for an unthinned array and checks whether it has fewer than two entries. With a valid base close to one, the exponent interval can be enormous even when the eventual tick count is small. The upfront scan can dominate scale creation and does not stop when it has enough evidence to choose the tick strategy.

Source and tests were left untouched.
