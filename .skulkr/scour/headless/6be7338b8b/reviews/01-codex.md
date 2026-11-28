# Review saturation for `headless`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 11 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Snapshot traversal and large scene inputs | 1 | 1 | 0 |
| 2 | Concurrent shutdown and disposal completion | 1 | 2 | 0 |
| 3 | Page readiness and startup cleanup | 0 | 2 | 1 |
| 4 | Raster context recovery and encoding | 0 | 2 | 2 |
| 5 | Wire validation and render argument conversion | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Large snapshot arrays can fail before the headless page opens

[protocol.ts](packages/headless/src/protocol.ts#L67) · Pass 1 · Medium · Source-traced

holdsTypedArray spreads every array member into one push call. A raw or encoded snapshot with a nodes array beyond the engine's argument-count limit throws even when the individual nodes and requested output rectangle are valid. The equivalent live scene takes the toJSON branch and avoids this traversal.

### 2. A second dispose call resolves while the browser is still closing

[host.ts](packages/headless/src/host.ts#L162) · Pass 2 · Low · Source-traced

The first dispose sets disposed before it waits for opening or closing. If one owner starts disposal and another awaits dispose before releasing shared resources, the second caller gets an already resolved promise while the host's browser or context remains open. The same gap applies to async disposal.

Source and tests were left untouched.
