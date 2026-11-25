# Review saturation for `devtools.views`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 40 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Scene-tree reads overlapping a content revision | 1 | 1 | 0 |
| 2 | Serialized value summaries and truncation markers | 1 | 2 | 0 |
| 3 | Coalescer recovery after callback failures | 1 | 3 | 0 |
| 4 | History and dispatch follower lifecycle, polling, and toggles | 0 | 3 | 1 |
| 5 | Registry selection, filtering, and node detail | 0 | 3 | 2 |
| 6 | Trace rows, frame rendering, gesture legends, and view layout | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An older scene-tree response can overwrite the latest level

[useSceneTree.ts](packages/devtools/src/views/useSceneTree.ts#L33) · Pass 1 · Medium · Source-traced

With an asynchronous panel transport, delay the response to a scene-tree load and then deliver the response to a newer scene notice first. A delayed success still replaces the latest rows. A delayed error on a child level can also collapse the branch after a newer success. The hook checks mount state but has no per-parent request generation.

### 2. A truncated array is labeled with the length of its preview

[ValueView.tsx](packages/devtools/src/views/ValueView.tsx#L40) · Pass 2 · Low · Source-traced

Expand an object field holding a 300-element array serialized with the default cap. The preview holds 100 elements and one truncation marker, so the summary reports Array(101). The marker records how many entries were omitted, which the summary can use to show 300.

### 3. A synchronous callback failure permanently wedges coalesced reads

[coalesced.ts](packages/devtools/src/views/coalesced.ts#L15) · Pass 3 · Low · Source-traced

If a query callback throws before returning its promise, go has already set busy and never calls done. Subsequent schedule requests only set again, so the view cannot retry. An asynchronous rejection takes the done path and can retry normally.

Source and tests were left untouched.
