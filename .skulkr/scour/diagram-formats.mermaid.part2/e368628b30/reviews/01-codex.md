# Review saturation for `diagram-formats.mermaid.part2`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 34 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Sankey CSV field counts and delimiter boundaries | 1 | 1 | 0 |
| 2 | Radar named values and duplicate assignments | 1 | 2 | 0 |
| 3 | Mind map node identity across write and read | 1 | 3 | 0 |
| 4 | Kanban metadata, requirement fields, and state scoping | 0 | 3 | 1 |
| 5 | Sequence participant lifecycles and transcript escaping | 0 | 3 | 2 |
| 6 | Packet ranges, timeline periods, pie slices, and XY axes | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A trailing comma bypasses the Sankey row's field-count check

[read.ts](packages/diagram-formats/src/mermaid/sankey/read.ts#L36) · Pass 1 · Low · Source-traced

The row `Source,Target,1,` has four fields with an empty last field, but csvFields returns after advancing to the end and drops that empty field. The Sankey reader accepts the malformed row. Adding a nonempty fourth field correctly triggers the field-count error.

### 2. A named radar curve silently ignores a second value for the same axis

[parse.ts](packages/diagram-formats/src/mermaid/radar/parse.ts#L83) · Pass 2 · Low · Source-traced

For axes a and b, give a curve values keyed as a:1, a:2, b:3. All keys exist, and the resolver finds one entry for each axis, so it returns [1,3] and discards the second value for a. The positional case rejects mismatched counts. A repeated named assignment should receive a line-numbered error.

### 3. A plain mind map node silently loses its explicit ID

[write.ts](packages/diagram-formats/src/mermaid/mindmap/write.ts#L54) · Pass 3 · Low · Source-traced

Export a native mind map with a plain node whose ID is 'root' and whose display text is 'Start'. With no outline, the writer emits just Start even though it has computed an ID. Reimport generates n1, so the ID changes without a warning. The bracketed path can write explicit IDs and preserve them.

Source and tests were left untouched.
