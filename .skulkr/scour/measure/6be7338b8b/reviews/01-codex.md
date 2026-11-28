# Review saturation for `measure`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 21 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Picked-end affordances and overlapping measurements | 1 | 1 | 0 |
| 2 | Command target identity after node layer changes | 1 | 2 | 0 |
| 3 | Gesture snapping, overrides, and commit cleanup | 0 | 2 | 1 |
| 4 | Measurement geometry, corresponding unit frames, and painters | 0 | 2 | 2 |
| 5 | Readout subscriptions, contribution wiring, and tool bindings | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An overlapping endpoint can block a picked measurement handle

[measureLayer.ts](packages/measure/src/measureLayer.ts#L60) · Pass 1 · medium · Source-traced

The hit test first picks the newest measurement endpoint in reach, then rejects it if it is not the picked endpoint while measuring. It never checks the older picked endpoint underneath. Two overlapping measurements can therefore show an editable handle that cannot be grabbed, and the drag can start a separate measurement instead.

### 2. Commands can keep targeting a picked measurement moved off their layer

[measurements.ts](packages/measure/src/measurements.ts#L57) · Pass 2 · medium · Source-traced

The picked-node shortcut checks geometry and visibility but skips the layer check applied to the fallback list. After the picked node moves to a different layer, a readout using the old Measurements instance can still show it and Delete can remove it, even though that instance's hit test and Clear command no longer include the node.

Source and tests were left untouched.
