# Review saturation for `labkit.primitives`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Progress states and accessibility values | 1 | 1 | 0 |
| 2 | Split sizing and controlled placement feedback | 0 | 1 | 1 |
| 3 | Floating panel persistence and anchor defaults | 0 | 1 | 2 |
| 4 | Styles, reduced motion, and story coverage | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A finished job with no total still exposes an indeterminate progressbar

[JobProgress.tsx](packages/labkit/src/primitives/JobProgress.tsx#L36) · Pass 1 · medium · Source-traced

The visible bar becomes full when a job without a reported total succeeds, but aria-valuenow is still omitted because determinate depends only on total. The accessible progressbar therefore still represents indeterminate progress, and its label remains Job progress without any success status. A successful empty job is affected as well.

Source and tests were left untouched.
