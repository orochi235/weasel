# Review saturation for `renderer.part2`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 38 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Readback rectangle validation and async lifetime | 1 | 1 | 0 |
| 2 | Tile scratch target allocation and failure recovery | 1 | 2 | 0 |
| 3 | Retained identity, pan reuse, clipping and surface budgets | 0 | 2 | 1 |
| 4 | Pattern resolution, texture ownership and paint registration | 0 | 2 | 2 |
| 5 | Text bounds, sprite frames, coordinate conversion and render state | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Async pixel readback can decode with changed rectangle dimensions

[readPixels.ts](packages/renderer/src/readPixels.ts#L26) · Pass 1 · Medium · Source-traced

The backend receives a checked copy of the rectangle immediately. The promise callback then uses width and height from the caller's original object. Changing or reusing that object before the promise settles can reorder rows incorrectly or cause the copy to throw.

### 2. Failed tile scratch resize leaves a deleted target cached

[TileTextures.ts](packages/renderer/src/retain/TileTextures.ts#L58) · Pass 2 · Medium · Source-traced

scratchFor deletes the old target before assigning the replacement. When createTarget throws, the old handle stays in the scratch field. A later bake at the original size returns that deleted target, and cleanup can try to delete it again.

Source and tests were left untouched.
