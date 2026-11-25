# Review saturation for `apps.draw.src.dev`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 41 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Resolution widget synthetic input versus dispatcher matching | 1 | 1 | 0 |
| 2 | Source-link generation and repository path characters | 1 | 2 | 0 |
| 3 | Registry deep links and filtering | 0 | 2 | 1 |
| 4 | Toolkit state, route reflection and conflict displays | 0 | 2 | 2 |
| 5 | Asset lists, schema tables and dispatch trace rendering | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The Resolution widget cannot inspect middle-button drag matches

[resolutionInput.ts](apps/draw/src/dev/resolutionInput.ts#L111) · Pass 1 · Low · Source-traced

Choose a drag binding that requires the middle mouse button. The widget offers no button control and synthesized pointerdown events omit pointerButton. The matcher defaults that field to primary, so the binding cannot appear in the simulated resolution.

### 2. Source links break when the checkout path contains URL delimiters

[sourceLinks.tsx](apps/draw/src/dev/detail/sourceLinks.tsx#L74) · Pass 2 · Low · Source-traced

Open an inspector source link from a checkout whose directory name contains a hash. The link places the raw path after vscode://file/ and the URL parser treats the remainder as a fragment. The editor receives a truncated path. Callback links use the same unescaped construction.

Source and tests were left untouched.
