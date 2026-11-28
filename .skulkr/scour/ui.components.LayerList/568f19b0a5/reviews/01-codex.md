# Review saturation for `ui.components.LayerList`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 11 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Tree mutation, move identity, and invalid destinations | 1 | 1 | 0 |
| 2 | Drag and keyboard drop restrictions, locks, and fixed walls | 0 | 1 | 1 |
| 3 | Inline rename, focus restoration, and IME handling | 0 | 1 | 2 |
| 4 | Visibility and lock toggles, solo behavior, and collapse state | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Repeated IDs in a move duplicate the layer in the resulting tree

[layerTree.ts](packages/ui/src/components/LayerList/layerTree.ts#L36) · Pass 1 · Low · Verified with a read-only Node probe

`moveLayers` lifts each layer once but builds its insertion block from the original ID array. Applying a move with `ids: ['a', 'a']` to `[a, b]` at root index 1 returned `[b, a, a]`. Repeated IDs in a caller-supplied move should be rejected or treated as one layer so the resulting tree keeps unique row identities.

Source and tests were left untouched.
