# Review saturation for `apps.shared`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Stale chunk handling and Vite's emitted errors | 1 | 1 | 0 |
| 2 | Hash and API-reference route round trips | 0 | 1 | 1 |
| 3 | Release grouping, summaries and version split | 0 | 1 | 2 |
| 4 | Preference test values, font bootstrap and app links | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Stale-chunk recovery reloads on ordinary module execution errors

[chunkReload.ts](apps/shared/chunkReload.ts#L55) · Pass 1 · Medium · Source-traced

When a lazy module is fetched successfully but throws during evaluation, Vite dispatches vite:preloadError with the exception as its payload. The shared listener prevents the error and reloads the document without checking the payload. An application error can therefore reload the editor and interrupt its current state before its own error handling receives anything.

Source and tests were left untouched.
