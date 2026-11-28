# Review saturation for `rig`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 16 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Active joint identity and selection changes | 1 | 1 | 0 |
| 2 | Gesture target stability across pointer samples | 1 | 2 | 0 |
| 3 | Screen-space brush and joint reach under nonuniform views | 1 | 3 | 0 |
| 4 | Skeleton commit and descendant binding cleanup | 0 | 3 | 1 |
| 5 | Overlay subscriptions, display and preference wiring | 0 | 3 | 2 |
| 6 | Action schema, tool registrations and package exports | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Changing rigs can silently select a different joint with the same name

[rigEditState.ts](packages/rig/src/bone/rigEditState.ts#L27) · Pass 1 · Medium · Source-traced

The active joint is stored by name alone, and the bone and weight actions only check that the current rig has a joint with that name. Since automatically generated names repeat across skeletons, selecting a different rig can immediately arm Delete or painting for its matching joint without a pick in that rig.

### 2. An ongoing weight stroke can commit edits under two rigs

[weightActions.ts](packages/rig/src/weight/weightActions.ts#L143) · Pass 2 · Medium · Source-traced

The stroke captures the joint name on press but resolves the rig again in every dab. If the selected or externally supplied rig changes mid-gesture, later samples paint paths in the new rig with the old joint name. The pending map accumulates edits from both rigs and commits them together.

### 3. Nonuniform zoom stretches joint hit targets and the weight brush

[placedRig.ts](packages/rig/src/bone/placedRig.ts#L28) · Pass 3 · Medium · Source-traced

sceneReach uses the larger world extent as a circular radius. Joint picking and weight painting then compare world distances against that scalar, while the dots and brush cursor are drawn in screen pixels. At unequal axis scales, input reaches beyond the displayed ring along the more magnified axis and can select a joint that is farther away in screen space.

Source and tests were left untouched.
