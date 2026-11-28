# Review saturation for `labkit.trial.part2`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 27 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Orbit lens fields and resize placement decisions | 1 | 1 | 0 |
| 2 | Job capability lifecycle while a run is in flight | 1 | 2 | 0 |
| 3 | Annotation storage replacement, subscriptions, and persistence | 0 | 2 | 1 |
| 4 | History restoration, remote replacement, and undo grouping | 0 | 2 | 2 |
| 5 | Trial providers, tool slots, layers, and 3D detection | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Resizing a trial can overwrite an edited orbit lens

[useViewPlacement.ts](packages/labkit/src/trial/useViewPlacement.ts#L30) · Pass 1 · medium · Source-traced

The resize path only reapplies the fitted view when sitsAt says the camera has not moved. For 3D views, that test omits fov, near, far and depth. A controlled camera with an edited FOV but unchanged target, yaw, pitch and distance is mistaken for its opening view, so a viewport resize overwrites the lens edit with the initial view.

### 2. Removing a job capability can leave the old producer running

[useTrialJob.ts](packages/labkit/src/trial/useTrialJob.ts#L26) · Pass 2 · medium · Source-traced

The hook substitutes NO_JOB when capability disappears, which hides the handle but does not cancel an existing run. For a job with no key, both the previous and replacement keys are null, so the underlying useJob effect sees no change that stops it. The old producer keeps executing and its remaining items are passed to the replacement no-op reducer instead of being aborted.

Source and tests were left untouched.
