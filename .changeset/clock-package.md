---
'@weasel-js/clock': patch
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

New package `@weasel-js/clock`: labkit's trial clock, moved out so it has no React and no DOM. `createClock`, `clockPosition`, `ClockSpec`, `Clock`, `ClockHandle`, `ClockPosition`, `ClockedMix`, `CLOCK_RATES`, and `createClockRegistry`, whose `lab` field is now `shared`; the frame loop `useClockLoop` is in `@weasel-js/clock/react`. labkit keeps `ClockCapability`, `TrialClock`, `ClockPosition` and `ClockedMix` as aliases, and `TRANSPORT_RATES` in ui is `CLOCK_RATES`.

`ClockSpec` takes `origin`, the time `elapsed` 0 is shown as (display only), and `speed`, the unsigned speed a transport plays a paused clock at. `Clock` reads both back, and `ClockHandle.declare(spec)` takes up a new `duration`, `origin`, `loop` and `speed` while keeping the shown time (`origin + elapsed`), clamped to the new run. This adds API.

The ui `Transport` takes `start`, where its scrub bar begins, so it can show a playhead before zero. labkit exports `useTransportControl` and `TransportControl`; `TransportControl` gains `start`, `touched` and `touch`, its `playhead` and `seek` work in shown time, and the keyboard Home and End and `labkit:seek` follow.

labkit exports `useTrialClockHandle`, the resolver behind `useTrialClock`. A snapshot keeps the trial's clock position, and loading it moves the clock back there.

`ClockHandle.override(span)` replaces the declared `duration` and `origin` until called with `null`, and a later `declare` leaves it in place. `ClockPosition` records `origin` when it differs from the declared one, and a reopened trial clock comes back at the time it showed. `holdAt`, `declare` and `override` place a time on a pass boundary at the end of the pass before.

forge's story timelines run on the shared clock. A story's `timeline` declares its trial's labkit clock, so the trial's transport is labkit's `TrialTransport` (its scrub bar is named "Position"), it shows a lead-in below zero, and the paused playhead is kept in the trial's record rather than in a `$playhead` config key. A config saved with `$playhead` still opens, without the key reaching the story. `usePlayhead`, `useTimeline` and the `TimelineSpec`, `TimelineSpan` and `SpanOverride` types keep their shape. One change in behavior: a span set at runtime keeps the playhead's shown time rather than following the span's start. A timeline with a duration or rate that is not a positive number runs as 1 ms or at speed 1 instead of throwing.
