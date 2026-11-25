# Review saturation for `diagram.containers`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Lane minimum sizes through the pool layout lifecycle | 1 | 1 | 0 |
| 2 | Header and body geometry for caller-supplied header depths | 1 | 2 | 0 |
| 3 | Drop eligibility and nested coordinate frames | 0 | 2 | 1 |
| 4 | Lane resize, add, and release operations against scene history | 0 | 2 | 2 |
| 5 | Affordance hit geometry, stencil registration, and title placement | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An undersized lane stays below the lane minimum when followed by another

[laneStack.ts](packages/diagram/src/containers/laneStack.ts#L92) · Pass 1 · Low · Source-traced

Lay out a pool containing a 20-unit lane followed by an 80-unit lane in a 100-unit stack. The layout copies the first lane's size unchanged and only clamps the last lane. The first lane remains below the documented 40-unit minimum, while resizing that lane through the action clamps it to 40.

### 2. A negative header depth expands the accepted drop body past the container

[trait.ts](packages/diagram/src/containers/trait.ts#L75) · Pass 2 · Low · Source-traced

A caller supplying a top header size of −10 gets a header of height −10 and a body starting 10 units above the box. The insert hit test and layout drop region use that expanded body, allowing a drop outside the visible container. Invalid depths should be rejected or kept within the box.

Source and tests were left untouched.
