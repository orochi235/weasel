# Review saturation for `diagram.part2`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 39 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Item drop eligibility versus the final pointer position | 1 | 1 | 0 |
| 2 | Edge routing, labels, hit indexes, and placement invalidation | 0 | 1 | 1 |
| 3 | Force and grid layout, graph assembly, and fitted containers | 0 | 1 | 2 |
| 4 | Text measurement, image lifetime, and package entry points | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Item drops reuse a verdict from another point within the same target

[itemDrop.ts](packages/diagram/src/itemDrop.ts#L105) · Pass 1 · Medium · Source-traced

Supply canDrop that accepts only the left half of a target using ItemDropTarget.at. Hover the accepted half first, then release in the refused half without changing target, container, or insertion index. The cached verdict is reused, and report receives an accepted drop at the refused position. Starting on the refused half gives the inverse failure.

Source and tests were left untouched.
