# Review saturation for `path-tools.pathEdit`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 19 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Dynamic drag weighting, snap targets, and extension teardown | 2 | 2 | 0 |
| 2 | Preview and commit geometry, storage and constraint finishing | 0 | 2 | 1 |
| 3 | Selection, mark handling, and mode entry and exit | 0 | 2 | 2 |
| 4 | Keyboard commands, field actions, hit testing and symmetry | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Changing the Drape radius leaves self-snap targets stale

[dragSnap.ts](packages/path-tools/src/pathEdit/editAnchors/dragSnap.ts#L19) · Pass 1 · P2 · Source-traced

Start an anchor drag with Drape set to a small radius, then scroll to enlarge it until another anchor starts following. The snap session was created on the first move from the original set of still anchors. Wheel handling recomputes Drape weights and reruns the move, but the session keeps offering the newly moving anchor and adjacent geometry at their old positions. The lead anchor can snap to a point on the same moving path that is no longer there.

### 2. A failing drag cleanup prevents later extensions from ending

[extensionDrags.ts](packages/path-tools/src/pathEdit/editAnchors/extensionDrags.ts#L66) · Pass 1 · P3 · Source-traced

Register two drag extensions whose end callbacks release separate resources. If the first callback throws during a cancellation or commit, the loop exits before notifying the second. The later extension can retain its drag state or subscription after the tool is idle.

Source and tests were left untouched.
