# Review saturation for `apps.site.demos.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 48 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Concurrent export delivery and result controls | 1 | 1 | 0 |
| 2 | Gesture demo pointer ownership | 1 | 2 | 0 |
| 3 | Image, font fallback and ingestion lifecycle | 0 | 2 | 1 |
| 4 | Diagram live layout, editing sessions and history | 0 | 2 | 2 |
| 5 | Kernel 3D picking, HUD and geometry demo state | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An older export can overwrite the latest download

[ExportDemo.tsx](apps/site/demos/ExportDemo.tsx#L52) · Pass 1 · Low · Source-traced

Start a slow export, switch format or region, then start a faster one. Each completion writes the same download slot and neither is associated with the latest request. If the first finishes last it replaces the requested file with the old one.

### 2. A second touch can replace the Gesture Grammar pad's active press

[GestureGrammarDemo.tsx](apps/site/demos/GestureGrammarDemo.tsx#L188) · Pass 2 · Low · Source-traced

Put down two fingers inside the pad. Each pointerdown sees button zero and overwrites the single stored press. Moves and releases do not check pointer identity, so releasing either touch can end or activate a gesture belonging to the other.

Source and tests were left untouched.
