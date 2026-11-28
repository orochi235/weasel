# Review saturation for `labkit.annotations`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 50 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Overlay scroll handoff and browser scroll coordinates | 1 | 1 | 0 |
| 2 | Capture dimensions, encoding, and base composition | 1 | 2 | 0 |
| 3 | Mark storage, projection, updates, and history | 0 | 2 | 1 |
| 4 | Calibration scoring and trial coordinates | 0 | 2 | 2 |
| 5 | Mark painting, target placement, and tool option wiring | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Horizontal wheel handoff cannot scroll an RTL container left

[wheelScroll.ts](packages/labkit/src/annotations/wheelScroll.ts#L18) · Pass 1 · medium · Source-traced

The handoff assumes horizontal scrollLeft ranges from zero to positive overflow. In an RTL scroller, the starting right edge is zero and scrolling left uses negative offsets. A leftward wheel over the annotation overlay is rejected at the right edge because the offset is never at least 1, and the browser cannot natively scroll the covered element from the portalled input box.

### 2. SVG export reports success for non-finite capture scales

[capture.ts](packages/labkit/src/annotations/capture.ts#L232) · Pass 2 · low · Source-traced

The public scale is used without a finite or positive check. With NaN, both result dimensions become NaN and the SVG composer writes width and height attributes containing NaN. With Infinity it writes Infinity. The function still returns a successful SVG result with invalid dimensions.

Source and tests were left untouched.
