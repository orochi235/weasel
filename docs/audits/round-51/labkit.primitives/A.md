# Audit round 51 — labkit.primitives

## A finished or failed job that never reported a total keeps sweeping as if still working
- where: packages/labkit/src/primitives/JobProgress.tsx:18-25 (JobProgress), packages/labkit/src/primitives/JobProgress.less:26-28
- scenario: a job whose `run` never yields `{ kind: 'total' }` (the case the doc comment calls out) finishes; `useJob` sets `status: 'done'` with `total` still `null` (useJob.ts:68), or the run throws and status becomes `'error'`. `determinate` is false, so the track gets `lk-job__track--indeterminate` and the fill runs the infinite `lk-job-sweep` animation; the rule is not scoped to `.lk-job--running`. The bar keeps saying "working" indefinitely next to a finished count or an error message, and the progressbar has no value. It should stop sweeping once status is not `running` (e.g. show a full or empty static fill for `done`/`error`).
- evidence: read
- severity: medium

## A count past the total is clamped for the bar but not for the progressbar's value or the count's sizer
- where: packages/labkit/src/primitives/JobProgress.tsx:19,28,48 (JobProgress)
- scenario: `JobEvent` documents that `total` "may arrive at any point and may arrive more than once", so a job can revise its total below what it has already done (or emit more items than it counted): `done: 130, total: 120`. The fill clamps (`Math.min(1, done / total)`), but `aria-valuenow` is the raw 130 against `aria-valuemax` 120, a value outside its own range that assistive tech reports as 108%; and the hidden sizer reserves only `"120 / 120"`, so the visible `"130 / 120"` is wider than the reserved cell and pushes the failures/Cancel controls over, the jitter the sizer exists to prevent. The clamp should be one decision applied to the fill, the ARIA value and the sizer (e.g. size to `max(done, total)`).
- evidence: read
- severity: low

## Files read
packages/labkit/src/primitives/JobProgress.less
packages/labkit/src/primitives/JobProgress.stories.tsx
packages/labkit/src/primitives/JobProgress.tsx
packages/labkit/src/primitives/PersistedFloatingPanel.less
packages/labkit/src/primitives/PersistedFloatingPanel.stories.tsx
packages/labkit/src/primitives/PersistedFloatingPanel.tsx
packages/labkit/src/primitives/Split.less
packages/labkit/src/primitives/Split.tsx
packages/labkit/src/primitives/index.ts
packages/labkit/src/primitives/splitFloors.ts

<!-- done: 2 findings, files read: 10 -->
