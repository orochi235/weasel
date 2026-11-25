# Review saturation for `forge.shell.part2`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 34 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Shared story loads and per-story preparation failures | 1 | 1 | 0 |
| 2 | Story annotation export and captured canvas contents | 1 | 2 | 0 |
| 3 | Frame handoff, host attachment, and trial lifecycle | 0 | 2 | 1 |
| 4 | Route history, component trees, and folder reveal | 0 | 2 | 2 |
| 5 | Issue listing, keyboard bindings, and workshop chrome | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. One story's preparation failure prevents other stories in its file from opening

[storyLoads.ts](packages/forge/src/shell/storyLoads.ts#L134) · Pass 1 · Medium · Source-traced

The shared file promise awaits preparation for every sibling before publishing any story. If preparing B throws, the shared promise rejects and the failure handler marks every ID in that file faulted. Opening A therefore fails even when A prepared successfully. The isolated-frame loader prepares only the selected story.

### 2. Annotation exports omit canvas pixels from their story background

[storyMarks.ts](packages/forge/src/shell/storyMarks.ts#L59) · Pass 2 · Medium · Source-traced

captureHost builds the annotation background by cloning and serializing the story host. A DOM clone of a canvas does not carry its backing bitmap, and the SVG serialization contains only the canvas element. Marks over a Canvas2D or WebGL story can therefore export without the artwork they annotate, even when the canvas was rendered before capture.

Source and tests were left untouched.
