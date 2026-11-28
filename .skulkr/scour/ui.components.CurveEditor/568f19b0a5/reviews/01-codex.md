# Review saturation for `ui.components.CurveEditor`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 33 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | History snapshots and custom layer state contracts | 1 | 1 | 0 |
| 2 | Pointer gesture lifecycle and layer dispatch | 0 | 1 | 1 |
| 3 | Function anchors, ordered bounds, and curve hit tests | 0 | 1 | 2 |
| 4 | Keyframe ordering, focus, and interpolation handles | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Undo cannot restore a custom layer whose earlier state was undefined

[useLayerHistory.ts](packages/ui/src/components/CurveEditor/useLayerHistory.ts#L50) · Pass 1 · Low · Source-traced

`CustomLayer` permits a state type including `undefined`. A snapshot of a mounted layer records that value as an entry, but restoration tests the result of `Map.get` against `undefined`. A layer starting in an unset state can commit its first value, yet built-in Undo skips restoring the unset state as if the snapshot had no entry for that layer.

Source and tests were left untouched.
