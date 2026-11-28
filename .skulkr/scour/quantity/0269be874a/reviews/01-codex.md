# Review saturation for `quantity`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 24 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Finite boundaries in spin snapping, duration formatting and scale bars | 3 | 3 | 0 |
| 2 | Localized input, grouping, suffixes and compound term parsing | 0 | 3 | 1 |
| 3 | Unit expression arithmetic, scoped conversions and affine unit contracts | 0 | 3 | 2 |
| 4 | Display dispatch, range parts, scientific and proportion formatting | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A positive fine step can produce NaN when snapping a finite value

[spin.ts](packages/quantity/src/spin.ts#L43) · Pass 1 · P3 · Source-traced

Call snapToStep(1e-21, 1e-21). decimalPlaces caps both operands at twenty places, the integer conversion rounds the scaled step to zero, and stepsFrom divides zero by zero. The public snap helper returns NaN even though its input is already an exact step.

### 2. Large finite durations format as Infinity and NaN

[measure.ts](packages/quantity/src/kinds/measure.ts#L129) · Pass 1 · P3 · Source-traced

Present Number.MAX_VALUE as a duration with one fractional place. The intermediate conversion to tenths overflows, making total and hours infinite and the subsequent minute and second calculations NaN. The formatter renders those invalid components for a finite duration.

### 3. A translated unit scope can make a scale bar zero pixels long

[scaleBar.ts](packages/quantity/src/scaleBar.ts#L56) · Pass 1 · P3 · Source-traced

Pass one scope whose scale has factor 1 and offset 1e16, pxPerUnit 1, and a single candidate length 10. toRoot(1) and toRoot(0) round to the same number, so their difference is zero and the scale bar reports zero pixels for ten units. Translation should leave length unchanged.

Source and tests were left untouched.
