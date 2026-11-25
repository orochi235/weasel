# Review saturation for `diagram.part3`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 39 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Asynchronous layout freshness after an edge edit | 1 | 1 | 0 |
| 2 | Frame-count boundaries for eased layout | 1 | 2 | 0 |
| 3 | Off-page marker reference allocation across pages | 1 | 3 | 0 |
| 4 | Port snapping, transforms, and affordance indexing | 0 | 3 | 1 |
| 5 | Label stations, placement, and route previews | 0 | 3 | 2 |
| 6 | Layout actions, radial placement, marks, and outline adapters | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An async layout plan can survive replacement of the edge it planned

[livePlan.ts](packages/diagram/src/livePlan.ts#L18) · Pass 1 · Medium · Source-traced

Start a delayed layout, then replace an edge with a different ID between the same node IDs without moving either node. sameGraph sees the same boxes and endpoint pairs, so it accepts a response containing routes keyed by the removed edge. The new edge misses those routes and the stale plan starts instead of being dropped.

### 2. A negative frame count makes eased layout run without arriving

[liveProducers.ts](packages/diagram/src/liveProducers.ts#L39) · Pass 2 · Low · Source-traced

Pass frames=-1 to easedProducer. The calculated progress becomes more negative on every frame and never reaches one, so the producer never reports done and applies easing outside its normal interval. An invalid frame count should be rejected or normalized before the run starts.

### 3. Allocating new off-page references repeatedly scans the occupied prefix

[split.ts](packages/diagram/src/offPage/split.ts#L62) · Pass 3 · Low · Source-traced

Split many connectors while creating or importing a multi-page diagram. Each new reference starts checking from A even though all earlier references just allocated are occupied. The assignment performs quadratic reference checks in one split batch.

Source and tests were left untouched.
