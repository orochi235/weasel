# Review saturation for `forge.vite.part1`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 27 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Capture cache identity and observable state ordering | 1 | 1 | 0 |
| 2 | Git history cache invalidation across release tag changes | 1 | 2 | 0 |
| 3 | Capture queue lifecycle, image limits, and payload validation | 0 | 2 | 1 |
| 4 | Static story indexing, export resolution, and auto titles | 0 | 2 | 2 |
| 5 | Component graph refresh, build entry pages, and issue responses | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Capture cache treats distinct object iteration orders as the same render

[endpoint.ts](packages/forge/src/vite/capture/endpoint.ts#L28) · Pass 1 · Medium · Source-traced

The cache key sorts keys recursively, while the payload passed to the renderer retains its original key order. A story can render rows in Object.entries order from a config or state record. Two requests with the same pairs in different order get the same cache key, so the second can receive the first layout. The client-side Pixels key also canonicalizes the payload, but direct requests to the endpoint independently exhibit the cache collision.

### 2. Renaming a lightweight release tag can leave component versions stale

[history.ts](packages/forge/src/vite/history.ts#L158) · Pass 2 · Low · Source-traced

The cache key includes HEAD and tag object IDs but omits the ref names. Replacing one lightweight release tag with a differently named tag on the same commit can leave that sequence of IDs unchanged. The history reader then returns the old version labels even though a fresh name-rev call would report the replacement tag.

Source and tests were left untouched.
