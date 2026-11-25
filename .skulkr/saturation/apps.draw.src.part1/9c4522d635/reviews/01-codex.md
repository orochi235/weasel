# Review saturation for `apps.draw.src.part1`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 38 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Native file commands, document metadata and export selection | 0 | 0 | 1 |
| 2 | Pathfinder replacement slots and system or user layers | 1 | 1 | 0 |
| 3 | Workspace view and active tool wiring | 0 | 1 | 1 |
| 4 | Clipboard flavors, toolbar and command predicates | 0 | 1 | 2 |
| 5 | Layer rows, loupe state and document units | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Pathfinder replacement pieces are put on the default layer

[booleansAdapter.ts](apps/draw/src/booleansAdapter.ts#L65) · Pass 2 · Medium · Source-traced

Use Draw with a scene containing eligible paths on a user layer. Pathfinder mints each replacement with its source parent but omits the source layer, so pathNode uses default. Moving the piece back to its sibling slot does not restore layer paint order. Under a parent on a higher layer the insert can be refused altogether.

Source and tests were left untouched.
