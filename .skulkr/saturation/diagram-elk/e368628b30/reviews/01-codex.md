# Review saturation for `diagram-elk`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 4 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Coordinate-system options and nested placement decoding | 1 | 1 | 0 |
| 2 | Edge-section connectivity and route assembly | 1 | 2 | 0 |
| 3 | Cluster parent cycles, ID mapping, and named port placement | 0 | 2 | 1 |
| 4 | Pinned-node anchoring, authored routes, and label projection | 0 | 2 | 2 |
| 5 | Planner option precedence, lazy runner initialization, and exports | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An ELK coordinate option makes nested placements relative to the wrong origin

[elkPlan.ts](packages/diagram-elk/src/elkPlan.ts#L77) · Pass 1 · Medium · Source-traced

Set elkOptions['elk.json.shapeCoords'] to 'PARENT' on a graph with a nested participant. The public override replaces ROOT, but fromElk still reads child coordinates as root positions. A read-only probe of the installed runner returned child x=12 with PARENT versus x=24 with ROOT, for a cluster at x=12. The plan uses 12 as the child's absolute x.

### 2. Edge sections are flattened in array order instead of connection order

[fromElk.ts](packages/diagram-elk/src/fromElk.ts#L44) · Pass 2 · Medium · Source-traced

A supplied ELK runner can return a two-section edge with the downstream section listed first and links identifying the upstream section. The adapter appends downstream points then upstream points, creating a backwards connecting segment and interpreting the junction as both route endpoints. The section link fields are available in the ELK type but ignored.

Source and tests were left untouched.
