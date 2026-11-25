# Review saturation for `apps.draw.src.part2`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 39 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Legacy paint migration against current inherited paints | 1 | 1 | 0 |
| 2 | Session migration consistency on storage failure | 1 | 2 | 0 |
| 3 | SVG open and import, locks and page placement | 0 | 2 | 1 |
| 4 | Recorded input timing, typed snapshots and playback | 0 | 2 | 2 |
| 5 | Opacity scrub, compound splitting and export boundaries | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Reload converts current inherited paints into literal colors

[persistence.ts](apps/draw/src/persistence.ts#L52) · Pass 1 · Medium · Source-traced

Reload a drawing or paste a snapshot with a child whose fill or stroke is the current inherit sentinel. Migration runs on current decoded node data as well as old snapshots. It wraps the string as a solid color, so the scene stops resolving it from the parent.

### 2. Session migration deletes old metadata before writing the replacement scene

[openSession.ts](apps/draw/src/openSession.ts#L60) · Pass 2 · Medium · Source-traced

Put a scene with history and document metadata in IndexedDB and a newer scene by itself in localStorage. If IndexedDB can delete records but then rejects the replacement write, the migration has already deleted the older scene's companion records. The old scene can still open without its prior history or filename data.

Source and tests were left untouched.
