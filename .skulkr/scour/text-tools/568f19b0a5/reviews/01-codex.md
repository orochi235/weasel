# Review saturation for `text-tools`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 32 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Tool routing, insertion, and plain-text ingestion | 0 | 0 | 1 |
| 2 | Scene edit ownership and commit targets | 1 | 1 | 0 |
| 3 | Property-panel text replacement and run styling | 1 | 2 | 0 |
| 4 | Hit testing, transforms, and screen projection | 0 | 2 | 1 |
| 5 | Painter, outline, clipping, and effect items | 0 | 2 | 2 |
| 6 | Host editor registration, stand-ins, and preset wiring | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An open edit can overwrite text in a replacement scene

[useSceneTextEdit.ts](packages/text-tools/src/editor/useSceneTextEdit.ts#L278) · Pass 2 · Medium · Source-traced

The editor hook retains its editing ID and overlay when the `scene` argument changes on a mounted host with the same container. The pending edit is read from the old overlay, but `onChange` looks up and updates the ID through the latest `sceneRef`. When the replacement scene has an unlocked node with the same ID, committing the old edit writes its text and runs to that node.

### 2. Replacing the first character of a styled run can drop its styling

[properties.ts](packages/text-tools/src/node/properties.ts#L131) · Pass 3 · Low · Source-traced

`respellRuns` says replacement text takes the style of the run the replacement starts in. At a run boundary, `runStyleAt(runs, head)` chooses the run on the left. Editing plain `a` followed by bold `b` to `ac` in the Text property makes `c` plain even though it replaces the bold `b`.

Source and tests were left untouched.
