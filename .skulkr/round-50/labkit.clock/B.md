I couldn't save `.skulk/out/findings.md` because the write was refused, so here is the whole document.

# labkit.clock — round 50 findings

## Play does not restart a run that was played backward to its start
- where: packages/labkit/src/clock/transportControl.ts:62 (transportControl `play`); also packages/labkit/src/clock/TrialTransport.tsx:47-52 (`replay` effect)
- scenario: a seekable clock with a set length is played backward (held `backward: true`) until elapsed reaches 0. At that point `syncTo` sets its rate to 0, and `ended` stays false. Pressing Play, or Space through `toggle`, sets `rate = -speed` at elapsed 0, and the next sync puts the rate straight back to 0, so Play does nothing. The forward case is handled: "A run played to the end starts over". The backward case should do the same by seeking to the run's end before playing backward. `replay` has the same gap: it keys on `clock.ended`, so a run played backward to its start never replays. When `replay` does fire, it sets `clock.rate = speed`, which plays forward and ignores the held direction.
- evidence: read (packages/clock/src/clock.ts `syncTo`, lines 178-187, sets the rate to 0 at elapsed 0 without setting `ended`)
- severity: medium

## A declaration whose speed comes from `rate` is never redeclared when it changes
- where: packages/labkit/src/clock/useTrialClockSetup.ts:32-33 (`shape`), used at 124-132
- scenario: an instrument declares `clock: (c) => ({ duration: 1000, rate: c.rate })` and gives no `speed`. `declare` takes the speed as `spec.speed ?? restingSpeed(spec.rate ?? 0)` (packages/clock/src/clock.ts `declaredOf`). But `shape` keys on the raw `s.speed`, which is `undefined` both times, and ignores `rate`. So an edit that changes `rate` from 1 to 2 leaves the shape the same and `declare` is never called. `clock.speed`, the speed a transport plays a paused clock at, stays at 1 while the declaration says 2. `shape` should key on the resolved speed, using the same rule `declare` applies.
- evidence: read
- severity: low

## A trial's keyed transport answers page keys when no trial is focused, contrary to its doc
- where: packages/labkit/src/clock/useTransportKeys.ts:122 (`answersFor`); doc at 90-92
- scenario: the doc says a transport inside a trial answers keys "from outside every trial while its trial is the lab's focused one". `answersFor` also returns true for such a key when `focused === null`. Take a lab with two trials, each holding `<TrialTransport keys>`, and no trial focused. Pressing Space with focus on the page body plays whichever transport claimed the keys first (`keys.all` insertion order), which is effectively arbitrary. Either the doc or the `focused === null` branch is wrong. Going by the doc, it should answer only when `focused === own`.
- evidence: read
- severity: low

## Files read
packages/labkit/src/clock/ClockFrames.stories.less
packages/labkit/src/clock/ClockFrames.stories.tsx
packages/labkit/src/clock/HeldClock.tsx
packages/labkit/src/clock/TrialTransport.tsx
packages/labkit/src/clock/contexts.ts
packages/labkit/src/clock/hooks.ts
packages/labkit/src/clock/index.ts
packages/labkit/src/clock/runTo.ts
packages/labkit/src/clock/transportControl.ts
packages/labkit/src/clock/transportHold.ts
packages/labkit/src/clock/trialClock.ts
packages/labkit/src/clock/useLabClocks.ts
packages/labkit/src/clock/useTransportControl.ts
packages/labkit/src/clock/useTransportKeys.ts
packages/labkit/src/clock/useTrialClockSetup.ts

<!-- done: 3 findings, files read: 15 -->