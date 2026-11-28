# Review saturation for `svg.part2`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 47 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Serialized definition IDs and authored node IDs | 1 | 1 | 0 |
| 2 | Clip definition visibility and geometry | 1 | 2 | 0 |
| 3 | Referenced symbol conditions and normal element traversal | 1 | 3 | 0 |
| 4 | Gradient coordinates, image placement and pattern handling | 0 | 3 | 1 |
| 5 | Text placement, stroke output and export bounds | 0 | 3 | 2 |
| 6 | Animation timing, stylesheet parsing and import packaging | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Generated SVG definitions can collide with authored node IDs

[serialize.ts](packages/svg/src/serialize.ts#L47) · Pass 1 · Medium · Source-traced

The serializer makes a definition registry without reserving the IDs it will later write on nodes. A node named grad0 or clip0 can share its ID with a generated definition in the same document, making fragment references ambiguous and producing duplicate IDs on export.

### 2. A hidden clip shape can still clip imported content

[readClips.ts](packages/svg/src/readClips.ts#L49) · Pass 2 · Medium · Source-traced

The clip reader lowers its lone supported shape directly into an outline. It skips the visibility and display checks the ordinary element reader makes, so a shape dismissed by display:none or inherited hidden visibility still contributes geometry to the imported clip.

### 3. The use path skips conditional checks on a referenced symbol

[use.ts](packages/svg/src/use.ts#L55) · Pass 3 · Low · Source-traced

Ordinary use targets go through the normal element reader, which checks systemLanguage and requiredExtensions. The symbol path checks only display and dispatches its children directly. A referenced symbol whose own conditional attributes fail can therefore still appear in the import.

Source and tests were left untouched.
