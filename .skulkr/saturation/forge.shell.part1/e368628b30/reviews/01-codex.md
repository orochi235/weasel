# Review saturation for `forge.shell.part1`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 35 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Frame failure and queued accessibility audit lifecycle | 1 | 1 | 0 |
| 2 | Story config identity across shell-owned keys | 1 | 2 | 0 |
| 3 | Frame pooling, adoption, and isolated preview updates | 0 | 2 | 1 |
| 4 | Route synchronization, global options, and instrument caching | 0 | 2 | 2 |
| 5 | Workshop panels, story information, issues, and host styling | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An import fault leaves the accessibility audit waiting indefinitely

[frameLink.ts](packages/forge/src/shell/frameLink.ts#L193) · Pass 1 · Medium · Source-traced

The accessibility panel starts an audit when a frame connects. The link queues it until rendered, but an import fault can leave the connected frame unable ever to send rendered. The fault handler leaves the queued and pending audits untouched, so the panel stays on Checking with Re-check disabled until the link closes.

### 2. Stripping Forge-owned config keys can reuse an object with different own properties

[globals.ts](packages/forge/src/shell/globals.ts#L148) · Pass 2 · Low · Source-traced

The identity check compares key count and values but does not require the previous object to own each new key. Changing from a config with a: undefined to one with b: undefined, while retaining $globals, can return the old stripped object because getOwn returns undefined for the missing b. A story using Object.hasOwn or enumerating config still sees a, and a frame update can be suppressed entirely.

Source and tests were left untouched.
