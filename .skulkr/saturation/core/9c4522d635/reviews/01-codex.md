# Review saturation for `core`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 37 files in the root `core` area of the working-tree [Skulkr partition](docs/audits/partition.json). The passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Keyboard state reconciliation and simultaneous modifiers | 1 | 1 | 0 |
| 2 | Pointer ownership, scope and element teardown | 1 | 2 | 0 |
| 3 | Test hook setup, replacement and live props | 1 | 3 | 0 |
| 4 | Affordance hit ordering, paint correspondence and anchor routes | 0 | 3 | 1 |
| 5 | Shortcut registration, modes and fallback tools | 0 | 3 | 2 |
| 6 | Provider scope, settings, test helpers and public exports | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| C1 | Releasing one Meta key clears ordinary keys while the other Meta key is still held | [keyState.ts](packages/core/src/input/keyState.ts#L148) | 1 | Low | Source-traced |
| C2 | Teardown of one pointer publisher can clear another publisher's latest point | [usePublishPointer.ts](packages/core/src/input/usePublishPointer.ts#L35) | 2 | Medium | Source-traced |
| C3 | The test hook keeps probe callbacks from its first render | [useTestHook.ts](packages/core/src/test-hook/useTestHook.ts#L12) | 3 | Low | Source-traced |

- **C1.** Press both Meta keys, press and keep holding an ordinary key, then release only one Meta key. The modifier flags still say Meta is held, but the ordinary codes are cleared as if the modifier chord ended. A polling consumer therefore sees the ordinary key go up even though it is still physically held.
- **C2.** Have two canvas publishers share the pointer store. After B publishes a new point for the same view ID, unmount A. A's cleanup clears B's point because it compares the view ID alone. Both canvases use a null view ID for their top-level camera, and a shared provider can expose both publishers to one store. The comparison cannot identify the publisher that owns the current value. [Publisher caller](packages/core/src/canvas/SceneCanvas/PointerProviderIfRoot.tsx#L34)
- **C3.** Mount with `?test=1` and pass a test probe through `useTestHook`. Rerender with a replacement callback closing over newer state. The scene and selection getters read the latest ref, but the probe map was copied by creation and the effect depends only on the stable ref. The global test hook continues invoking the old callback.

Source and tests were left untouched. The findings are based on source review.
