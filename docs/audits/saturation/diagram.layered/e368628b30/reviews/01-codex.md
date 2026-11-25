# Review saturation for `diagram.layered`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Label row expansion on long labeled graphs | 1 | 1 | 0 |
| 2 | Cycle reversal, rank assignment, and adjacent-hop construction | 0 | 1 | 1 |
| 3 | Cluster spacing, pin placement, and band constraints | 0 | 1 | 2 |
| 4 | Waypoint and compass-port output across directions | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Label row assignment scans every labeled gap for every rank lookup

[expand.ts](packages/diagram/src/layered/expand.ts#L67) · Pass 1 · Low · Source-traced

Lay out a long chain with a label on each connector. Each rank and each label-to-row lookup filters the complete list of labeled gaps, allocating a temporary array each time. This makes label row numbering quadratic on a common diagram shape where a cumulative gap count would suffice.

Source and tests were left untouched.
