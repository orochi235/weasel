# Review saturation for `apps.site.demos.part5`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 48 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Audio score startup and unlock failures | 1 | 1 | 0 |
| 2 | Storage and streaming cache subscriptions | 0 | 1 | 1 |
| 3 | SVG source replacement and export snapshots | 0 | 1 | 2 |
| 4 | Text font loading, shape demos and navigation controls | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Score playback reports no error when audio unlock fails

[ScoreDemo.tsx](apps/site/demos/ScoreDemo.tsx#L83) · Pass 1 · Low · Source-traced

Press Play where the audio engine's unlock rejects. The demo observes only the successful branch of the promise. It stays labeled stopped with no error, and the failed action raises an unhandled rejection.

Source and tests were left untouched.
