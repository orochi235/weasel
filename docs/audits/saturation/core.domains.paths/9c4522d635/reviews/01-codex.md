# Review saturation for `core.domains.paths`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 22 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Snap index cache keys and scrolled ancestor frames | 1 | 1 | 0 |
| 2 | Snap geometry and shown node data | 1 | 2 | 0 |
| 3 | Path storage and representation write-back | 0 | 2 | 1 |
| 4 | Marker projection and overlay gates | 0 | 2 | 2 |
| 5 | Stroke outlines and anchor editor state | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Path snaps remain at the old positions after scrolling

[sceneIndex.ts](packages/core/src/domains/paths/pathSnap/sceneIndex.ts#L45) · Pass 1 · Medium · Source-traced

Build the index, then scroll a container whose children contribute snap targets. The geometry is built from the scrolled pose frame, but the cache key omits scroll generation and scroll writes leave the scene version unchanged. A subsequent query gets the old targets.

### 2. Path snapping reads committed data while rendering uses a data override

[sceneIndex.ts](packages/core/src/domains/paths/pathSnap/sceneIndex.ts#L58) · Pass 2 · Low · Source-traced

Publish a shown override replacing a mark's data-backed path while leaving its pose alone. The index rebuilds, but sends the original node and only the shown pose to nodeSnapGeometry. Geometry based on node.data still describes the committed outline while the displayed path has changed.

Source and tests were left untouched.
