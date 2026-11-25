# Review saturation for `export`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Selected subtree traversal against renderer consumption | 1 | 1 | 0 |
| 2 | Selection bounds and layer annotation filtering | 1 | 2 | 0 |
| 3 | PNG warmup diagnostics compared with the final render plan | 1 | 3 | 0 |
| 4 | Capture retries, revision consistency, and page lookup | 0 | 3 | 1 |
| 5 | Format registration, option handling, and region cardinality | 0 | 3 | 2 |
| 6 | Raster coordinates, scale, background, and bitmap lifetime | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A consumed child can produce a selection export region even though it is never drawn

[selectionRegion.ts](packages/export/src/selectionRegion.ts#L50) · Pass 1 · Medium · Source-traced

Pass a child ID beneath a node with consumesChildren to selectionRegion. The visibility gates do not test consuming ancestors, so the child's geometry supplies a region even though the render walk suppresses that child. The same traversal descends into a hidden-layer or annotation-layer consumer even though buildSceneTree suppresses its children.

### 2. A selected parent’s bounds include annotation ink excluded by export

[selectionRegion.ts](packages/export/src/selectionRegion.ts#L29) · Pass 2 · Medium · Source-traced

The annotation check filters the requested IDs, while drawnAabbOf recursively measures the selected parent's descendants against the original scene. A visible annotation-layer child outside a fixed parent’s bounds enlarges the region even though planPixelRender excludes that layer. This can leave excess blank space or include unrelated document objects within the resulting crop.

### 3. Strict PNG export checks warmup commands instead of the final plan

[regionPng.ts](packages/export/src/regionPng.ts#L25) · Pass 3 · Medium · Source-traced

warmRender reports command losses from its initial plan, but capturePngRegion builds the actual plan again without passing its read-stage diagnostic sink anywhere. If a painter changes while warmup awaits resources, the final commands can include an unregistered marker or shader without GLSL absent from the first plan. The scene content revision need not change for a registry update, so strict mode can accept the incomplete raster.

Source and tests were left untouched.
