# Review saturation for `diagram.avoid`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 25 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Transform preview invalidation when bounds resize in place | 1 | 1 | 0 |
| 2 | Preview budget fallback and locked or removed connectors | 1 | 2 | 0 |
| 3 | Committed dirty sets, seed behavior, and history restoration | 0 | 2 | 1 |
| 4 | Search turns, candidate ports, grid bounds, and visibility | 0 | 2 | 2 |
| 5 | Obstacle indexing, routing labels, nudging, and route storage | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A resize with a fixed top-left corner can leave the preview route stale

[install.ts](packages/diagram/src/avoid/install.ts#L96) · Pass 1 · Medium · Source-traced

Resize a shape by dragging its bottom-right handle while its top-left stays fixed. After the first preview, still() compares only x and y, so the growing bounds and moving ports do not trigger rerouting. The follower returns the earlier route until the next commit.

### 2. An exhausted preview budget can return a route for a locked connector

[router.ts](packages/diagram/src/avoid/router.ts#L209) · Pass 2 · Low · Source-traced

Preview a dirty connector, then preview another frame where that connector is locked and the budget is already spent. The budget branch returns its old preview before looking up the connector or checking locked. The same frame with a sufficient budget correctly omits the connector.

Source and tests were left untouched.
