# labkit.primitives findings

(Note: the checkout's HEAD is 674caba3dd, not the d6aa8f2ede named in the brief. Line numbers are from the tree as checked out.)

## A finished job with any failed items never fills its bar or reaches its total
- where: packages/labkit/src/primitives/JobProgress.tsx:19 (JobProgress)
- scenario: `useJob` (packages/labkit/src/job/useJob.ts:55-64) increments `done` only on `item` events. A `failed` event goes into `failures` and leaves `done` alone. So a job with `total: 120` and 2 failures ends at `status: 'done'` with `done: 118`, and JobProgress draws the fill at 118/120 and prints "118 / 120" on a finished job. It reads as stalled at 98% rather than complete. Progress should count processed items (`done + failures.length`). The `WithFailures` story (JobProgress.stories.tsx:33-45) shows `done: 120, total: 120` with 2 failures, a state useJob cannot produce, and that hides the bug.
- evidence: read
- severity: medium

## A job with no total keeps sweeping "working" after it has finished or failed
- where: packages/labkit/src/primitives/JobProgress.tsx:18,25 (JobProgress); packages/labkit/src/primitives/JobProgress.less:27-29
- scenario: a job that never sends `total` (a case the component documents as normal) completes. `status` becomes `'done'` (or `'error'`) while `total` is still null, so `determinate` is false and the track keeps `lk-job__track--indeterminate`. Its infinite `lk-job-sweep` animation is not scoped to `--running`, so the bar keeps animating "working" forever beside a finished count. `total: 0` hits the same path. The indeterminate class or the animation should apply only while `status === 'running'`.
- evidence: read
- severity: medium

## A total revised below `done` puts aria-valuenow past aria-valuemax and outgrows the count's sizer
- where: packages/labkit/src/primitives/JobProgress.tsx:28-30,47 (JobProgress)
- scenario: `total` "may arrive more than once" (job/types.ts:1). Take a job that reports 1000, processes 150, then revises its total to 99. It renders `aria-valuenow=150 aria-valuemax=99`, which is an invalid ARIA range: the fill is clamped by `Math.min(1, …)` but the attributes are not. Also, the sizer `"99 / 99"` is narrower than the shown `"150 / 99"`, so the count's cell grows and the cancel button shifts. That is the reflow the sizer exists to prevent.
- evidence: read
- severity: low

## A controlled `width` is not enforced: a drag the parent rejects stays applied
- where: packages/labkit/src/primitives/Split.tsx:178-182,186-196 (Split)
- scenario: a parent renders `<Split width={w} onWidthChange={() => {}}>` to pin the width, or clamps it back to the value it already holds. The drag moves the store's placement and sets `widthRef` to the dragged value. The `width` prop never changes, so the effect keyed on `[store, width]` does not rerun, and the sidebar stays at the dragged width while the prop says otherwise. The prop documents itself as "the sidebar's current extent", so the store should go back to `width` when the parent doesn't adopt the reported value.
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

<!-- done: 4 findings, files read: 10 -->
