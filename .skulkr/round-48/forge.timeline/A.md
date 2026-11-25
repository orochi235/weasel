## After a hashchange re-holds the playhead, the user's next seek (or play under a pending hold) never reaches the URL's `t`
- where: packages/forge/src/timeline/RoutePlayhead.tsx:46-52 (PlayheadSync, `onHashChange` → `fromUrl`, with `toUrl` at 33-40)
- scenario: On mount, `fromUrl` makes its hold before `clock.subscribe(toUrl)`, so the hold's listener runs first on every later change. It sees a foreign seek or a rate change, releases itself, and `toUrl` then reads `pending() === null` and writes the URL. A `hashchange` on the same route calls `fromUrl` again, and that makes a new hold *after* `toUrl` subscribed. `createEmitter` emits in insertion order, so `toUrl` now runs before the new hold's listener. Say the user edits the hash to `…?t=2`. The hold places the clock at 2000 ms, and then the user clicks the scrub bar at 0.5 s, or a story calls `useTimeline().seek(500)`. `toUrl` runs first. The hold is not released yet, and `wanted` sees `clock.elapsed !== shown - origin`, so `pending()` returns 2000, not null. `toUrl` returns without writing. The hold's listener then releases, but no further clock change arrives while paused, so the URL keeps `t=2` while the playhead stands at 0.5 s. Reloading or sharing the link opens at 2 s. The same happens when the hold is still pending (for example a `t` past the current span) and the user presses play: the URL keeps the stale `t` for the whole playback. Expected: the hold releases before `toUrl` reads it, as on the mount path. Releasing inside `toUrl` when the clock has left the hold, or re-subscribing `toUrl` after each new hold, would make the two paths agree.
- evidence: read (packages/clock/src/hold.ts holdWhere/holdAt `pending`; packages/registry/src/emitter.ts emits in Map insertion order)
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
