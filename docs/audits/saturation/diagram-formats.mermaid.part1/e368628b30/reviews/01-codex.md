# Review saturation for `diagram-formats.mermaid.part1`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 35 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | GitGraph identity preservation during export and reimport | 1 | 1 | 0 |
| 2 | Block diagram link-token ordering and malformed statement handling | 1 | 2 | 0 |
| 3 | Flowchart style grouping on large graphs | 1 | 3 | 0 |
| 4 | Architecture and C4 group and endpoint mapping | 0 | 3 | 1 |
| 5 | Class and ER text and relationship serialization | 0 | 3 | 2 |
| 6 | Gantt and Journey round trips, common metadata, and format dispatch | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. GitGraph export can collapse two branch names into one

[write.ts](packages/diagram-formats/src/mermaid/gitgraph/write.ts#L13) · Pass 1 · Medium · Source-traced

Create two branches named a"b and a'b, which are distinct in the native GitGraph model. Export replaces the double quote with a single quote, so both branch declarations produce the same branch name. Reimport fails because replay rejects a duplicate branch, even though the original graph replayed successfully.

### 2. A trailing block link operator can turn adjacent blocks into an edge

[parse.ts](packages/diagram-formats/src/mermaid/block/parse.ts#L126) · Pass 2 · Low · Source-traced

Read a block diagram containing a line `A B -->`. The parser collects blocks and operators into separate arrays, then accepts the line because two blocks and one operator satisfy the count check. The reader creates A → B even though the operator had no right-hand endpoint. A syntax error should identify the unfinished link.

### 3. Flowchart export repeatedly copies every node ID in a shared style group

[write.ts](packages/diagram-formats/src/mermaid/flowchart/write.ts#L116) · Pass 3 · Low · Source-traced

Export a large graph whose nodes all share the same non-default style. For each node the writer spreads all IDs already in that style group into a new array. This makes grouping quadratic in the size of a common style group, even though each ID only needs to be appended once.

Source and tests were left untouched.
