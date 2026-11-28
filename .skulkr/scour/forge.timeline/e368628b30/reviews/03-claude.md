## RoutePlayhead skips a linked `t` after a detour through a story with no clock
- where: packages/forge/src/timeline/RoutePlayhead.tsx:47 (PlayheadSync effect)
- scenario: Route A, which has a timeline, opens and its `t` is applied, so `appliedRef.current = 'A'`. Next the user goes to route B, a story with no timeline. B's `PlayheadSync` mounts with `handle === null`, and the effect returns at `if (!handle) return;` before it updates `appliedRef`, so the ref still says 'A'. Then the user follows a link back to A with `t=2`. A's new `PlayheadSync` mounts after that `hashchange` has already fired, finds `appliedRef.current === route`, and skips `fromUrl()`. `toUrl()` then writes the clock's own state, which is null for a clock at its origin, so `t=2` is erased instead of applied. The trial should open at 2 s.
- evidence: read
- severity: medium
- size: line
- cause: applied-route marker only updated when a clock handle exists
- confidence: likely

## OwnClock's registry keeps the first handle, so a clock made later never ticks
- where: packages/forge/src/timeline/StoryClock.tsx:40 (OwnClock)
- scenario: A CSF story's `parameters.forge.timeline` is a function that returns no spec at some args, for example `(args) => args.animate ? { duration: 3000 } : undefined`. `timelineOf` passes the result through unchecked, and `WithStoryClock` hands it to `OwnClock`, where `useOwnClock` treats a falsy spec as "no clock". On that first render, `createClockRegistry(handle)` is created with `shared = null` and frozen in `useState`. When the args change and the function returns a spec, `useOwnClock` creates a clock and the context provides it, but the registry `useClockLoop` drives still has `shared = null`. The story's `play()` sets `rate` and the playhead never moves. Expected: the registry tracks the current handle, or `OwnClock` remounts when the handle changes. The same applies if the handle is ever replaced.
- evidence: read
- fix: packages/forge/src/timeline/StoryClock.tsx
- severity: low
- size: function
- cause: registry captured once from initial handle
- confidence: likely

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

<!-- done: 2 findings, files read: 12 -->
