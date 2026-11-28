# Review saturation for `plot.part2`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 44 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Scene replacement ownership and radar and Sankey numeric boundaries | 3 | 3 | 0 |
| 2 | Prop and history synchronization, theme defaults and compiler dispatch | 0 | 3 | 1 |
| 3 | Packet and timeline structural edits and schema wiring | 0 | 3 | 2 |
| 4 | Pie, quadrant and XY layout and mounted editor behavior | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Replacing chart data deletes unrelated children of the plot root

[plotScene.ts](packages/plot/src/plotScene.ts#L115) · Pass 1 · P2 · Source-traced

Create a plot in a shared scene, add a normal annotation node parented to its root, then call replacePlotData. The function removes every child before adding regenerated marks. The annotation disappears although it has no plot mark trait and is outside the set the function promises to rebuild.

### 2. Radar value edits silently accept fractional axis indices

[edit.ts](packages/plot/src/radar/edit.ts#L10) · Pass 1 · P3 · Source-traced

Call setRadarValue on a curve with two axes and pass axis 0.5. The range check passes, but the array map never matches 0.5 and the returned chart contains no requested edit. With sparse values the call can still fill unrelated entries with zero. The API documents throwing for an axis the chart does not hold.

### 3. A Sankey diagram with tiny positive flows can collapse every ribbon

[layout.ts](packages/plot/src/sankey/layout.ts#L130) · Pass 1 · P3 · Source-traced

Lay out a single link valued at Number.MIN_VALUE in a normal positive-height box. The positive flow passes validation and normalization leaves the unit at one because the sum is finite. Dividing the available height by the tiny flow overflows, so scale becomes zero and both nodes and the ribbon get zero height. A chart containing one positive flow should show it at the available proportional height.

Source and tests were left untouched.
