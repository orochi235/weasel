# Review saturation for `apps.site.demos.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 48 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Debug capture timing and live render data | 1 | 1 | 0 |
| 2 | Audio engine, animator and transition cleanup | 0 | 1 | 1 |
| 3 | Diagram editing and controlled data reconciliation | 0 | 1 | 2 |
| 4 | Canvas view, shader and geometry demo interactions | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The debug snapshot can combine different frames

[DebugOverlayDemo.tsx](apps/site/demos/DebugOverlayDemo.tsx#L78) · Pass 1 · Low · Source-traced

Click Snapshot and move a node while renderer warm-up is awaiting fonts or paint. The click captures the view immediately, but the debug sink returns live frame arrays and the scene is also read later by renderDebugSnapshot. The saved image can contain the new geometry and overlay under the old camera instead of the frame the user captured.

Source and tests were left untouched.
