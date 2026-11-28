# Review saturation for `labkit.scene`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 11 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Trial reset signaling and canvas-owned path editing | 1 | 1 | 0 |
| 2 | Scene persistence, history observation, and restore | 0 | 1 | 1 |
| 3 | Tool activation reports and camera publication | 0 | 1 | 2 |
| 4 | Ruler and guide integration, canvas entry points, and story wiring | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Reset misses canvas-owned state when no scene edit was saved

[useTrialScene.ts](packages/labkit/src/scene/useTrialScene.ts#L66) · Pass 1 · medium · Source-traced

The reset notification is emitted only after stored scene JSON changes to null. A user can leave the canvas's default path edit without editing a scene node, keeping state.scene null. Reset then leaves that value null and the effect has no scene change to observe. TrialSceneCanvas relies on this notification to reopen the original path, so that reset does not restore its opening path-edit state.

Source and tests were left untouched.
