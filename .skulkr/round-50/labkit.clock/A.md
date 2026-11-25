## Play on a reversed run that has reached its start does nothing; only a forward run at its end starts over
- where: packages/labkit/src/clock/transportControl.ts:63 (transportControl, `play`)
- scenario: seekable clock with a duration, reversed (`setBackward(true)`), played back until `syncTo` stops it at elapsed 0 with rate 0. Press play (Space, the Transport's play button): `play` only seeks when `!held.backward && clock.ended`, so it sets `clock.rate = -speed` at elapsed 0; the next frame's sync sees `elapsed <= 0 && rate < 0` and sets the rate back to 0. The transport flickers to playing for one frame and nothing moves. The forward case ("a run played to the end starts over, the way a player's play does") seeks to 0; the backward mirror should seek to the end of the span (`clock.seek(span, 'end')`) before playing. The user has to un-reverse or scrub to get it moving again.
- evidence: read (packages/clock/src/clock.ts syncTo lines 183-187 stop a backward run at 0; `ended` is only `elapsed >= span`)
- severity: medium

## A trial's transport keeps the speed it opened at after a config edit re-declares the clock's speed
- where: packages/labkit/src/clock/transportHold.ts:24 (transportHoldOf)
- scenario: an instrument declares `clock: (c) => ({ duration: 4000, speed: c.speed })`. The transport mounts with the clock paused, so the hold opens at `clock.speed` = 1. The user edits config speed to 2: `useTrialClockSetup` sees the shape change (speed is in `shape`) and calls `handle.declare`, which sets `run.speed = 2`, so `clock.speed` reads 2. The hold is never told: `control.speed` still reads 1, the Transport shows 1x, and Play runs at rate 1. The engine applies the declared speed on one path (the clock) and the transport ignores it on the other; an untouched hold should follow `clock.speed`.
- evidence: read (clock.ts applyRun line 150 `run.speed = declared.speed`; transportHoldOf reads the clock only once, in the part's factory)
- severity: medium

## A config edit that changes only a clock's `rate` never reaches `declare`, though the declared speed follows it
- where: packages/labkit/src/clock/useTrialClockSetup.ts:32 (shape)
- scenario: an instrument declares `(c) => ({ duration: 3000, rate: c.rate })` with no `speed`. `declare`'s `declaredOf` takes speed as `spec.speed ?? restingSpeed(spec.rate ?? 0)`, so a rate edit from 1 to 2 changes the declared speed. `shape` keys on `s.speed`, which stays `undefined`, so the shape string does not change, the layout effect returns early and `declare` is never called: the clock's `speed` (what a pause returns to) stays 1. The key should use the speed `declare` would take, not the raw field.
- evidence: read (packages/clock/src/clock.ts declaredOf line 129)
- severity: low

## HeldClock forces `rate: 0`, which also resets a declaration's rate-derived speed to 1
- where: packages/labkit/src/clock/HeldClock.tsx:22 (holdAt)
- scenario: `<HeldClock spec={{ duration: 2000, rate: 2 }} at={500}>` with a `<TrialTransport>` or anything reading `clock.speed` inside. `createClock` takes `speed: spec.speed ?? restingSpeed(openRate)`, and `openRate` is now 0, so the held clock's speed is 1 rather than the 2 the declaration gives the trial's own clock. The transport hold opens at speed 1 and Play runs the held clock at 1x. `holdAt` should carry the speed across (`speed: spec.speed ?? (Math.abs(spec.rate ?? 0) || 1)`). `sameDeclaration` also skips `rate`, so a rate-only change would not reopen it either.
- evidence: read (clock.ts createClock line 311, restingSpeed line 60)
- severity: low

## useLabClocks records the lab clock's position against the latest `spec` though the clock keeps the mount's
- where: packages/labkit/src/clock/useLabClocks.ts:31 (useLabClocks effect)
- scenario: `<Lab clock={{ duration: 1000 }}>` re-renders with `clock={{ duration: 2000 }}`. Lab reads `clock` once (`useWarnIgnoredChange` warns), so the registry's clock keeps duration 1000. The effect re-runs with the new `spec`, and `clockPosition(lab.clock, 2000, …)` sees `clock.duration !== 2000` and writes `duration: 1000` into the record as if the run had been overridden. After a reload with `clock={{ duration: 2000 }}`, `createTrialClock(spec, record)` opens at `at.duration` = 1000: the ignored prop's old value is now permanent, overriding the spec read at mount. The effect should compare against the spec the clock was made from (kept with the registry). An inline `clock` literal also re-subscribes on every render.
- evidence: read (packages/clock/src/clock.ts clockPosition lines 10-23; createClock line 293 `at?.duration ?? spec.duration`)
- severity: low

## TrialTransport `replay` silently does nothing for a clock that is not seekable
- where: packages/labkit/src/clock/TrialTransport.tsx:47 (TrialTransport replay effect)
- scenario: an instrument declares `{ duration: 3000, seekable: false }` and the page sets `<TrialTransport replay={1000}>`. The run ends, but the effect returns early on `!clock?.seekable`, so the run stays ended forever. The prop's doc promises "Play a run that has ended again from the start after this many ms" with no seekable caveat, and a non-seekable clock can be returned to its start through `handle.reset()` (which sets `run.elapsed = opening()` without the seek check). Either the option should replay through `reset` or its doc should say it applies only to seekable clocks.
- evidence: read (clock.ts reset lines 352-359)
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

<!-- done: 6 findings, files read: 15 -->
