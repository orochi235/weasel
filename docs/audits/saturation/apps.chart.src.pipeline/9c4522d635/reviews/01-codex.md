# Review saturation for `apps.chart.src.pipeline`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 10 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Persistence during parameter previews | 1 | 1 | 0 |
| 2 | Source picker and async ownership | 1 | 2 | 0 |
| 3 | Run/step dispatch by domain | 1 | 3 | 0 |
| 4 | Page and cluster command targets | 0 | 3 | 1 |
| 5 | Palette, look options and parameter controls | 0 | 3 | 2 |
| 6 | Audio source disposal and merged run display | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Pipeline autosave persists a slider preview before it is committed

[usePipelineDoc.ts](apps/chart/src/pipeline/usePipelineDoc.ts#L58) · Pass 1 · Medium · Source-traced

Drag a parameter slider and hold it long enough for autosave, or close the tab mid-drag. Preview writes change the same doc used for persistence, and the save runs on the debounce or when the page leaves. Reopening loads the preview as document content despite receiving no committed edit.

### 2. A source-image pick can allocate a bitmap after its workspace unmounts

[pipelineRun.ts](apps/chart/src/pipeline/pipelineRun.ts#L130) · Pass 2 · Low · Source-traced

Start the file picker and unmount the pipeline workspace before it returns. chooseImage takes its ticket after awaiting the file picker, so the cleanup drops only earlier tickets. Successful decode can still hand the new bitmap to replace after the source hook has already run its final cleanup, leaving the bitmap unclosed.

### 3. Audio-only graphs expose Run and Step that only drive the empty image runner

[pipelineRun.ts](apps/chart/src/pipeline/pipelineRun.ts#L69) · Pass 3 · Low · Source-traced

Open a pipeline whose stages are all audio. Run and Step stay enabled and allocate or use the image source, then invoke the image runner with no stages. Neither starts nor advances the audio graph. Play has explicit audio dispatch.

Source and tests were left untouched.
