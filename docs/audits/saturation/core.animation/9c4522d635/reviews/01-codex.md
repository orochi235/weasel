# Review saturation for `core.animation`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 26 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Adapter animation startup and lifecycle cancellation | 2 | 2 | 0 |
| 2 | Reflow keys, ghost ownership and staggered removal | 1 | 3 | 0 |
| 3 | Path motion anchors, orientation and geometry | 1 | 4 | 0 |
| 4 | Momentum branches, clamping and coast completion | 0 | 4 | 1 |
| 5 | Rig rebinding, skin remapping and clip target lookup | 0 | 4 | 2 |
| 6 | Live target axes, override publication and rewind handoff | 0 | 4 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| A1 | A rejected tween can still write and record its destination | [poseHelpers.ts](packages/core/src/animation/poseHelpers.ts#L110) | 1 | Medium | Source-traced |
| A2 | Cancellation from a tween start listener can strand a departing node | [animateLifecycle.ts](packages/core/src/animation/wrappers/animateLifecycle.ts#L95) | 1 | Medium | Source-traced |
| A3 | Reflow transitions sharing an animator can cancel each other's glides for the same node ID | [reflow.ts](packages/core/src/animation/reflow.ts#L49) | 2 | Medium | Source-traced |
| A4 | Path motion places an untransformed anchor on the path when the rendered pose is skewed or stretched | [pathMotion.ts](packages/core/src/animation/pathMotion.ts#L72) | 3 | Medium | Source-traced |

- **A1.** Call `tweenPose` with the default operation recording, a valid new pose, and `ms: NaN`. The helper records the transform before calling the animator. The animator then throws because the duration is NaN. A caller can catch a rejected animation and still have its destination written to the document and placed into history. [Duration validation](packages/animator/src/engine/tweenAnimation.ts#L8)
- **A2.** Attach an animator watcher that cancels a departing node's tween when it sees the synchronous start event. The lifecycle wrapper has already added the node to its leaving map but installs its cancellation watcher only after the tween call returns. The cancel event is missed, completion never runs, and a later remove request returns early because the leaving marker is still present.
- **A3.** Put two independent reflow transitions on one animator, with the same node ID in both scenes. Start a glide in each, then dispose one transition. Disposal stops its key, and the key is derived solely from the ID. The animator cancels the other transition's tween too. Its transition may retain an override that now has no animation to finish it.
- **A4.** Use an off-center anchor such as the right edge of a pose with horizontal stretch about its center. The placement applies rotation to the anchor offset but ignores the pose's linear transform. The rendered edge therefore stays displaced from the path even though the descriptor preserves the transform. The defect does not require tangent orientation.

Source and tests were left untouched. The findings are based on source review.
