# Review saturation for `minimap`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Indicator rendering under nonuniform custom fit views | 1 | 1 | 0 |
| 2 | Drag and pinch termination | 1 | 2 | 0 |
| 3 | Fit bounds, hidden scene layers, and live overrides | 0 | 2 | 1 |
| 4 | Standalone camera wiring, resize, and input subscriptions | 0 | 2 | 2 |
| 5 | Contribution attachment, linked cursor, and public exports | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Nonuniform fit scales distort the indicator's screen-pixel dash lengths

[minimapMath.ts](packages/minimap/src/minimapMath.ts#L155) · Pass 1 · medium · Source-traced

A custom fit can provide different x and y scales. Indicator dash lengths are converted using only the x scale before applying the view. With x scale 2 and y scale 4, a vertical dash covers twice the requested screen length while a horizontal dash covers the intended amount.

### 2. Minimap panning ignores the release position

[actions.ts](packages/minimap/src/actions.ts#L100) · Pass 2 · low · Source-traced

The pan action updates the main camera only in onMove and leaves onEnd empty. When a committed release carries a point beyond the last delivered move, the camera remains centered on the previous point. This can also occur if a release arrives before a queued move sample was delivered.

Source and tests were left untouched.
