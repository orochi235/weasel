# Review saturation for `guides`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 23 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Distance readout geometry and shared edge ranges | 1 | 1 | 0 |
| 2 | Guide placement, cancellation, undo, and source exclusion | 0 | 1 | 1 |
| 3 | Ruler tick layout, hit testing, and flipped axes | 0 | 1 | 2 |
| 4 | Grid, alignment, and spacing candidates across coordinate planes | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Containment distance markers can miss the outer box they measure to

[distance.ts](packages/guides/src/spacingHints/distance.ts#L65) · Pass 1 · Low · Source-traced

The containment branch establishes that the boxes overlap on the cross axis but draws both gaps at the inner box's midpoint on that axis. For a box spanning x=20..30 and y=0..100 inside another box's x=0..50 extent with y=90..110, the horizontal gaps appear at y=50, outside the outer box. The labels give the right projected distances but their endpoints float clear of the edges they measure.

Source and tests were left untouched.
