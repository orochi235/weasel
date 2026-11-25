# Review saturation for `core.core`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 28 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Scene streaming, partial failure and eviction ownership | 1 | 1 | 0 |
| 2 | Stylus subscriptions, element replacement and hover | 1 | 2 | 0 |
| 3 | Persistence, snapshot compatibility and history pairing | 0 | 2 | 1 |
| 4 | Selection legalization, chrome state and adapters | 0 | 2 | 2 |
| 5 | Device density, modifier updates, shape kinds and data helpers | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| C1 | A failed cell load can leave earlier additions outside stream ownership | [streamScene.ts](packages/core/src/core/stream/streamScene.ts#L91) | 1 | Medium | Source-traced |
| C2 | Stylus hover can remain active after the hovered target is replaced | [usePointerStylus.ts](packages/core/src/core/stylus/usePointerStylus.ts#L62) | 2 | Low | Source-traced |

- **C1.** Return a valid node followed by a node that throws during insertion, such as a second spec with the same fresh ID when the scene refuses duplicates. Earlier writes occur inside the map, but the loop that records streamed ownership runs only after the entire map returns. The failed cell cannot release the earlier node, and a retry filters it out as already present. The load should track each successful addition or roll back the cell on failure.
- **C2.** Enter the target with a pen, then replace the target while it is hovered. The effect removes its listeners and cancels the pending sample, but keeps the public state with `hovering: true`. If the pointer is outside the replacement, it has no leave event to clear that old state.

Source and tests were left untouched.
