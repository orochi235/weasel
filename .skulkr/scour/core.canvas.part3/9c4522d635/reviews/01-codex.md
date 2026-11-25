# Review saturation for `core.canvas.part3`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 39 files listed for this area in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Timeline render restoration and loop state | 1 | 1 | 0 |
| 2 | Timeline frame generation and interval boundaries | 1 | 2 | 0 |
| 3 | Raster session, readback, pixel IDs and export plans | 0 | 2 | 1 |
| 4 | Reach propagation, tile damage and visibility | 0 | 2 | 2 |
| 5 | Preview publication, selection order, clipboard and contribution wiring | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

| ID | Defect | Where | First | Severity | Evidence |
|---|---|---|---:|---|---|
| T1 | Rendering a looped span can consume the caller's remaining laps | [timelineFrames.ts](packages/core/src/canvas/timelineFrames.ts#L73) | 1 | Medium | Source-traced |
| T2 | The default half-open export emits a frame for an empty interval | [timelineFrames.ts](packages/core/src/canvas/timelineFrames.ts#L52) | 2 | Low | Source-traced |

- **T1.** Render a 100 ms timeline configured for two passes over an explicit span that reaches 150 ms. The seeks past 100 advance the timeline's lap and consume its remaining budget. Seeking back to the saved local playhead restores its time but does not restore either lap counter. After export, playback can end one pass sooner than it would have. The export claims to restore the timeline even on early termination. [Seek lap accounting](packages/animator/src/timeline/playhead.ts#L109)
- **T2.** Call `timelineFrameTimes(50, 50, 30)` with its default `includeEnd: false`. The count floor forces a frame at 50 even though no point belongs to the documented half-open interval. The ordinary timeline export consequently draws and yields a frame for an empty caller-selected span.

Source and tests were left untouched.
