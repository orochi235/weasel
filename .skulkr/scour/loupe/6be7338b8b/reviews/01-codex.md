# Review saturation for `loupe`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 11 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Capture lease acquisition and callback failure | 1 | 1 | 0 |
| 2 | Sampler geometry and zero-area layers | 1 | 2 | 0 |
| 3 | Eyedropper async ordering and disposal | 0 | 2 | 1 |
| 4 | Aim, pin, and model frame subscriptions | 0 | 2 | 2 |
| 5 | Action bindings, lens geometry, and zoom stops | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A redraw exception strands a canvas source reader

[canvasSource.ts](packages/loupe/src/canvasSource.ts#L229) · Pass 1 · medium · Source-traced

The first retain increments readers and calls requestRedraw before returning a release. If the supplied redraw throws, retain fails without returning a release, but the count stays incremented. The source can then keep copying frames with no real readers, and a later actual first reader does not request the missing redraw.

### 2. A zero-area source box can still contribute sampled color

[sampler.ts](packages/loupe/src/sampler.ts#L139) · Pass 2 · medium · Source-traced

canvasPixelSource uses a scale of one for an axis whose box extent is zero. A collapsed source with a populated backing canvas can thereby return a pixel at its box origin and for nearby points despite drawing no visible area. As an upper layer, its sample can hide the color of a visible layer below.

Source and tests were left untouched.
