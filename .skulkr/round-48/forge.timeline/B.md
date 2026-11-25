## A URL `t` change that matches the shown time, or drops `t`, leaves an earlier pending hold alive, which later moves the playhead to the stale time and writes it back
- where: packages/forge/src/timeline/RoutePlayhead.tsx:25 (PlayheadSync, `fromUrl`)
- scenario: The span is 5 s and the URL opens with `t=8`. `holdAt` waits at the span's end (shown 5000) with `pending() === 8000`, so `toUrl` keeps the URL as it is. The user then edits the hash to `t=5` for the same story (or deletes `t`). `onHashChange` calls `fromUrl`, which returns early: `t === shownTime(clock)` (5000), or `t === null`. It never releases the old hold. `toUrl` still sees `hold.pending() !== null` and returns. Later the story's `setSpan({ duration: 10000 })`, or a redeclared span, moves the span, and the hold re-places the clock at 8000. `toUrl` then writes `t=8`, overriding the 5 (or no `t`) the user asked for. Expected: a new `t` from the URL, matching or absent, replaces the earlier request. The hold should be released (and, for `null`, nothing held) before the early return.
- evidence: read (RoutePlayhead.tsx `fromUrl`/`toUrl`; packages/clock/src/hold.ts `holdAt`/`holdWhere`: the hold re-places on any duration or origin change, and `pending` reports the unclamped request until it is reached)
- severity: medium

## Files read
packages/forge/src/timeline/Playhead.stories.tsx
packages/forge/src/timeline/RoutePlayhead.tsx
packages/forge/src/timeline/StoryClock.tsx
packages/forge/src/timeline/clockSpec.ts
packages/forge/src/timeline/context.ts
packages/forge/src/timeline/declare.ts
packages/forge/src/timeline/moves.ts
packages/forge/src/timeline/playheadUrl.ts
packages/forge/src/timeline/shown.ts
packages/forge/src/timeline/transport.css
packages/forge/src/timeline/types.ts
packages/forge/src/timeline/workshopHarness.tsx

<!-- done: 1 findings, files read: 12 -->
