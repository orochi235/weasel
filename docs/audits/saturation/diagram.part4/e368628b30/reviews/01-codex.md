# Review saturation for `diagram.part4`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 36 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Route and label write ownership for locked connectors | 1 | 1 | 0 |
| 2 | Reconnect, waypoint editing, and route command commits | 0 | 1 | 1 |
| 3 | Scene synchronization, region reorder, and stencil insertion | 0 | 1 | 2 |
| 4 | Page presentation, shape geometry, and release lifecycle | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A layout can move the label toward a route it cannot write

[routeWrites.ts](packages/diagram/src/routeWrites.ts#L60) · Pass 1 · Low · Source-traced

Give a locked connector an unlocked, layout-positioned label and run a plan that supplies a new route and label point. The connector keeps its old route because it is locked, but the code still adds it to the ownership set. The label receives the point from the rejected route and can move to a different part of the old connector.

Source and tests were left untouched.
