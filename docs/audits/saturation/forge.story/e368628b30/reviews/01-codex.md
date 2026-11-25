# Review saturation for `forge.story`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Index entries matched against loaded module exports | 1 | 1 | 0 |
| 2 | Title normalization, story IDs, and index routing | 0 | 1 | 1 |
| 3 | Primary-file selection, library lookup, and tag aggregation | 0 | 1 | 2 |
| 4 | Native definition normalization, decorators, and public story types | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A missing indexed export is silently dropped from its component page

[indexBundle.ts](packages/forge/src/story/indexBundle.ts#L80) · Pass 1 · Medium · Source-traced

The loader publishes an index bundle even when an indexed export is absent from its loaded module. It drops the story from stories but retains that entry when computing shared tags, gallery and lab IDs, and descriptions. An index can thus appear successfully loaded with no stories at all, while opening the same missing entry directly reports the mismatch. This can occur when an index and importer are temporarily from different revisions.

Source and tests were left untouched.
