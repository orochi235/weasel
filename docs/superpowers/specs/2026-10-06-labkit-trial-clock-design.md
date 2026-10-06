# labkit trial clock — design

**Status: unbuilt.** Designed 2026-10-06. Delete this file when the work merges;
move anything worth keeping into `packages/labkit/docs/AGENTS.md` first.

**For:** whoever implements arc 1 below. **Answers:** what time is inside a
labkit trial, how an instrument reads it, and how anything outside the trial
plays, pauses, scrubs or reverses it.

## Where this sits

labkit is getting a **presentation mode**: an existing lab shown without its
chrome — one trial, chosen params, a few gestures, play controls — for portfolio
embeds, the way print preview shows a document. It is a mode of a lab, not a
second way of writing one. Today agnew (`?bare`), rosee (`?bare`, its own
`Bare.tsx` and transport) and transom (`?embed`) each hand-roll it.

Play controls need something to control, and labkit has no notion of time. So
the work is four arcs, each with its own spec:

| Arc | Builds | Rests on |
|---|---|---|
| **1. Trial clock** (this spec) | labkit owns each trial's clock | — |
| 2. Presentation mode | a public switch (prop, `?present`, debug toggle, `usePresentation`), one chrome-free trial seeded with given params, no persistence, transparent background | — |
| 3. Play controls | `<Transport>` bound to a trial's clock: play/pause, scrub, speed, reverse; Space and friends | 1, 2 |
| 4. Gestures | a `gestures` option on the trial canvas (pan, wheel `plain`/`mod`/off, pinch, tap), relaxed `touch-action` | — |

## Decisions

- **labkit owns the clock; instruments read time from it.** Pause, seek, speed
  and reverse then mean the same thing in every lab. An instrument that reads no
  time is unchanged.
- **blits conventions throughout.** blits (`~/src/blits`, `@msb235/blits`) is
  meant to replace weasel's animation engine eventually, so the clock uses its
  vocabulary and shapes and must not need renaming when that happens. In blits
  terms a trial clock is an **owner**: an instrument's voices would play under
  it. weasel does not depend on blits for this.
- **Reverse is first-class.** `rate` is signed. blits is gaining backward
  playback, so a blits-backed instrument can follow a backward clock; one that
  cannot declares `seekable: false`.
- **Opens paused, plays once.** `rate` defaults to `0` and `loop` to `false`.
  (A blits voice's rate defaults to 1; this default is labkit's.)

## The clock

```ts
/** blits' Ticked (sync, inert, onWake), plus the controls of an owner's Handle. */
interface TrialClock {
  /** ms the trial has played, rate applied. A position, as a blits voice's is. */
  readonly elapsed: number;
  /** Which pass this is, 0 first. */
  readonly pass: number;
  /** Signed. 0 pauses and negative plays backward. Changes speed at once. */
  rate: number;
  /** Moves to `rate` linearly over `over` real ms; position and speed stay continuous. */
  ramp(rate: number, over: number): void;
  /** Moves the clock, forward or back. Never runs state forward to meet it. */
  seek(elapsed: number): void;
  /** The host reports the frame's timestamp. Nothing advances at the call. */
  sync(timestamp: number): void;
  /** Time between this sync and the next does not count. */
  rebase(): void;
  /** Another frame would change nothing, so the loop may sleep. */
  readonly inert: boolean;
  /** Called when a change needs frames again; once until the next sync. */
  onWake(fn: () => void): () => void;
  /** labkit's own, for chrome: fires on rate, seek and loop changes, never per frame. */
  subscribe(fn: () => void): () => void;
}
```

Play and pause are not methods: pause is `rate = 0`, as in blits. Whatever
offers a play button remembers the rate to resume at — the last non-zero one,
else 1.

### Declaring it

An instrument opts in with a `clock` capability, beside `canvas`, `undo` and the
rest. Without it there is no clock and no transport.

```ts
clock?: {
  duration?: number;                      // ms per pass; Infinity when omitted
  loop?: boolean | number;                // passes: true endless, false one, n (default false)
  rate?: number;                          // starting rate (default 0: opens paused)
  freeze?: 'before' | 'after' | 'both';   // hold the end frame rather than show nothing
  seekable?: boolean;                     // default true
}
```

### Behavior

- **Ends.** Not looping, playing forward past `duration` or backward past 0
  holds at that end and sets `rate` to 0. Looping, the position wraps, in either
  direction, and `pass` counts.
- **`seek` is absolute**: ms from the trial's start, counted across passes, as
  blits' `Handle.seek(elapsed)` is — `seek(2.5 * duration)` on a looping clock
  lands halfway through the third pass. A relative jump is
  `seek(clock.elapsed + delta)`. A target below 0 clamps to 0; one past the end
  of a finite run (`duration × passes`) clamps to that end.
- **`seekable: false`** is for an instrument whose state is built up by running,
  so time can only move by running. `seek` throws for any target and a negative
  `rate` throws, as a blits mix rejects one today. Reverse play of a seekable
  instrument is continuous seeking, so one flag covers both. Making such an
  instrument seekable is blits' job, not labkit's: blits restores and steps its
  state, from a history store the client supplies (requested of blits
  2026-10-06; labkit would back it with the trial record). labkit grows no
  checkpoint-and-replay of its own.
- **Reset** (the existing trial built-in) restores the instrument's initial
  state and returns the clock to 0 at its declared `rate`, through labkit's own
  path, not the public `seek`, so it works on a clock that is not seekable.
- **Persistence.** The trial record gains `clock: { elapsed, rate }`, written on
  pause, seek and rate changes, never per frame, so a reload or a shared hash
  reopens the trial at the same moment.

## Reading time

| Where an instrument draws | How it reads time | When it redraws |
|---|---|---|
| Canvas layers | `draw(ctx, { state, config, zoom, elapsed, pass })`; a layer that reads time declares `timed: true` | Timed layers are marked dirty every frame the clock is not `inert`, and on every seek. Untimed layers keep redrawing only on state, view or size |
| Imperative renderers (three.js, WebGL) | `useClockFrame((elapsed, pass) => …)`, called after each `sync`, with no React render | Every frame the clock is not `inert` |
| `render` DOM | `ctx.trial.clock` for anything that controls time; per-frame text goes through `useClockFrame` into a ref | On `subscribe` changes only |

**No `step` hook.** A simulation advances itself from `useClockFrame`, or cues
blits voices under the clock. A labkit `step` would duplicate blits'
`patch.step` and become a second pathway once weasel moves onto blits.

## Reaching a clock from outside its trial

Mirrors `packages/labkit/src/canvas/cameraRegistry.ts`, which is how `LabZoom`
drives the focused trial's camera:

- a `ClockRegistry` on the lab, keyed by trial id, registrations stacking newest
  live;
- a trial publishes its clock on mount and again when it takes focus;
- **`useTrialClock(trialId?)`** returns that trial's clock, or the focused
  trial's. This is the public way in, for arc 3's transport, arc 2's
  presentation mode, and consumers' own panels.

**One frame loop per lab.** A single `useVisibleRaf` in the lab runtime calls
`sync(timestamp)` on every registered clock that is not `inert`, sleeps when all
are, and calls `rebase()` from `onResume`. Its shape is blits' `ticker` — `add`,
sleep on `inert`, wake on `onWake` — so a blits ticker can replace it.

## Not in this arc

Keyboard bindings and any visible transport (arc 3). Presentation mode itself
(arc 2).

## Testing

| What | How |
|---|---|
| Rate, ramp, seek, looping forward and backward, `freeze`, holding at an end, `rebase`, `inert`/`onWake`, the `seekable: false` throws, Reset on a clock that is not seekable | Unit tests driving `sync` with made-up timestamps; no rAF |
| Only timed layers repaint while playing | Layer-scheduler test counting `draw` calls per layer |
| `useClockFrame` fires after each `sync` and stops while paused | Hook test with a fake frame source |
| Registry and focus | Mirror `cameraRegistry`'s tests |
| Persistence | Round trip through the memory adapter |
| It really animates | A small timed demo instrument in labkit's demo lab, and a `*.browser.test` showing pixels change between two syncs and hold once paused |

Docs: a clock section in `packages/labkit/docs/AGENTS.md`, and `clock` in the
instrument capability list.
