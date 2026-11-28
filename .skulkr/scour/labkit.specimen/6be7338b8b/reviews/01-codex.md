# Review saturation for `labkit.specimen`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Interactive specimen controls and observable outcomes | 1 | 1 | 0 |
| 2 | Editor and plot state wiring | 0 | 1 | 1 |
| 3 | Fields, preferences, and selection state | 0 | 1 | 2 |
| 4 | Overlay composition, section semantics, and specimen layouts | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Cancel does not change the specimen job

[LabChrome.tsx](packages/labkit/src/specimen/LabChrome.tsx#L28) · Pass 1 · low · Source-traced

The demo renders JobProgress with a constant running job and a no-op cancel. The enabled Cancel button can be activated repeatedly without stopping the job or changing its visible state, so the specimen cannot demonstrate the cancellation behavior it exposes.

Source and tests were left untouched.
