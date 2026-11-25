# Review saturation for `diagram.hops`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Retrying stored hop writes after a connector unlocks | 1 | 1 | 0 |
| 2 | Crossing and merge geometry around endpoints and bends | 0 | 1 | 1 |
| 3 | Transform previews and dependency movement | 0 | 1 | 2 |
| 4 | Layer visibility, history invalidation, and static hop application | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Unlocking a connector can leave obsolete hops stored when its route disappeared

[install.ts](packages/diagram/src/hops/install.ts#L143) · Pass 1 · Low · Source-traced

A locked connector with stored hops can lose its routable polyline, such as when its endpoints move to separate pages. The pass computes an empty hop list, skips the locked write, and remembers the ID as stale. On unlock, freed filters out IDs lacking a polyline, so the required empty write is skipped and stale state remains even though the connector is writable.

Source and tests were left untouched.
