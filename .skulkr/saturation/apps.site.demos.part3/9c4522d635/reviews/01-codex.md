# Review saturation for `apps.site.demos.part3`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 48 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Mode decoration and in-progress pose reads | 1 | 1 | 0 |
| 2 | Loupe and minimap coordinate mapping and teardown | 0 | 1 | 1 |
| 3 | Label preview, printer lifetime and Mermaid loading | 0 | 1 | 2 |
| 4 | Path motion, page grid, tool bindings and gesture controls | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The focus outline stays at the old pose while a shape is dragged

[ModesDemo.tsx](apps/site/demos/ModesDemo.tsx#L102) · Pass 1 · Low · Source-traced

Enter Focus on a shape and drag or resize it without releasing. The scene paints the shown pose override, but the demo's dashed focus outline reads the authored node pose. It stays at the starting bounds and jumps to the shape when the gesture commits.

Source and tests were left untouched.
