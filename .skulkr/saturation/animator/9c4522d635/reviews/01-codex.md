# Review saturation for `animator`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 34 files listed in the [Skulkr partition](docs/audits/partition.json#L3), which was modified in the working tree. The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Hosted versus React animator lifetime and disposal | 1 | 1 | 0 |
| 2 | Skeleton, skin weights and brush edit normalization | 1 | 2 | 0 |
| 3 | Loop, stagger and supervisor completion paths | 0 | 2 | 1 |
| 4 | Target reads, writes, row storage and element bindings | 0 | 2 | 2 |
| 5 | Color and trim overrides, dispatch and restoration | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Finding | Location | First | Severity | Evidence |
|---|---|---|---:|---|---|
| A1 | A disposed hosted animator can accept work that never advances | [createHostedAnimator.ts](packages/animator/src/createHostedAnimator.ts#L51) | 1 | Medium | Executed |
| A2 | A NaN joint-weight edit can clear all influence on a point | [weightEdits.ts](packages/animator/src/rig/weightEdits.ts#L21) | 2 | Medium | Executed |

- **A1.** Create and dispose a hosted animator, then use a retained animator reference to register a 100 ms tween. Registration succeeds and `isActive()` returns true. The disabled host frame paths never run it, and repeating `dispose()` leaves it active. The exposed API can therefore retain callbacks and target state after host teardown, including work started by a late async caller.
- **A2.** Call `setJointWeights({a:[0.5],b:[0.5]}, 1, 'a', new Map([[0, NaN]]))`. The result is an empty skin. Clamping propagates NaN through the edited weight and the normalization of all other joints, then the cleanup drops the arrays. The function promises clamped weights and preserves positive influence totals where other joints weigh the point. An invalid requested weight should leave a consistent skin.

The probes bundled production modules in memory. Source and tests were left untouched.
