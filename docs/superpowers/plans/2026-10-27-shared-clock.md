# Shared clock package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: unbuilt (written 2026-10-27).**

**Goal:** One clock for the whole engine. labkit's trial clock moves into a new `@weasel-js/clock` package, and forge
drops its own clock (`packages/forge/src/timeline/{clock,trialClocks,useClockLoop,TransportBar}.ts*`) in favor of it.

**Architecture:** `@weasel-js/clock` takes labkit's `createTrialClock`, its clock registry, and its single frame loop.
Its root entry has no React; the loop lives behind `@weasel-js/clock/react`, the same layout as `@weasel-js/simulation`.
The clock gains what forge needs: a display `origin` (a lead-in that is not part of the clock's arithmetic), `declare`
(re-declaration that keeps the time on the clock), a `speed` for paused clocks, a hold for a time the span cannot reach
yet, and per-registration visibility. labkit re-exports the package and takes clocks declared from config. forge then
declares its story timeline as a labkit clock and keeps only a thin adapter behind `usePlayhead`/`useTimeline`.

**Tech Stack:** TypeScript, React 18 `useSyncExternalStore`, `useVisibleRaf` (`@weasel-js/react`), vitest (jsdom + the
`browser` project), tsup.

**Spec:** None separate. The design was settled in conversation and reviewed by another session (2026-10-27); every
decision is in this file.

## Global Constraints

- Work in a worktree on branch `clock-package`. Run `npm ci` there before building anything.
- Every changeset is `patch`. Name breaking or additive changes in the changeset prose.
- `npm run check:size`: no file over 400 lines and no function over 120. The moved clock has no allowlist entry at its
  new path, so `createTrialClock`'s 199-line body must be split as it moves.
- No bare `requestAnimationFrame`. Every loop goes through `useVisibleRaf` (`npm run check:frame-loops`).
- The root entry of `@weasel-js/clock` imports nothing from React or the DOM. Add it to `scripts/react-free-entries.mjs`.
- Published package source uses relative imports (no path aliases).
- Find which vitest project owns a directory with `npm run check:test-projects`. labkit runs under `labkit`, forge under
  `forge`, ui and react under `weasel-ui`.
- forge's story-facing API does not change shape: `timeline: TimelineSpec | (config) => TimelineSpec`, `usePlayhead()`
  and `useTimeline()` keep their signatures.
- forge keeps its current behavior: stories loop by default, and a span change keeps the playhead at the same time.

## Review Focus

- A story edited while its trial is open to add or drop its `timeline`: the clock should appear or disappear without
  remounting the trial, and the transport should come and go with it. (Task 6)
- `?t=2500` in the URL for a story whose span only reaches 2500 after a `setSpan` at runtime: the playhead should land on
  2500 once the span arrives, and the URL should keep `t=2500` until then. (Tasks 5, 7)
- A trial on the shared clock (`clock: 'lab'`) scrolled out of view: the shared clock should keep running, because other
  readouts follow it. (Task 3)
- A forge trial saved before this change, whose config still holds `$playhead`: it should open without error, and the
  key should not show up in the story's config. (Task 7)
- A playing, looping trial scrolled out of view for several seconds and back: it should resume where it stopped with no
  jump, and while every clock is hidden or paused the loop should request no frames. (Task 3)

---

### Task 1: Move the clock into `@weasel-js/clock`, with no change in behavior

**Files:**
- Create: `packages/clock/{package.json,tsconfig.json,tsup.config.ts,README.md,LICENSE}`. Copy from `packages/simulation`;
  entries `index` and `react`.
- Create: `packages/clock/src/index.ts`, `src/react.ts`.
- Move: `packages/labkit/src/clock/trialClock.ts` to `packages/clock/src/clock.ts`, split into modules of its own
  (suggested: `place.ts` for `placeOf`/`passesOf`, `ramp.ts` for the ramp step, `mixFollow.ts` for the mix host clock).
- Move: `clockRegistry.ts` (without the React contexts) to `packages/clock/src/registry.ts`.
- Move: `useClockLoop.ts` to `packages/clock/src/useClockLoop.ts`.
- Move tests: `trialClock.test.ts`, `trialClockMix.test.ts`, `clockRegistry.test.ts` to `packages/clock/src/`.
- Modify: `packages/ui/src/components/Timeline/Transport.tsx`. `TRANSPORT_RATES` re-exports `CLOCK_RATES` from
  `@weasel-js/clock`.
- Modify: labkit `clock/*`, `trial/Trial.tsx`, `lab/storeCommands.ts`, `instrument/types.ts`, `lab/still.ts`,
  `lab/labProps.ts`, `lab/presentationMessages.ts`, `clock/index.ts`.
- Modify: root `tsconfig.json` (two `paths` entries and `include`), `.changeset/config.json` (`fixed` group),
  `typedoc/categories.mjs`, `scripts/react-free-entries.mjs`, and `package.json` deps of labkit and ui.

**Interfaces:**
- Produces (`@weasel-js/clock`): `ClockSpec` (was `ClockCapability`), `Clock` (was `TrialClock`), `ClockHandle` (was
  `TrialClockHandle`), `ClockPosition`, `ClockedMix`, `createClock(spec: ClockSpec, at?: ClockPosition): ClockHandle`,
  `clockPosition(clock, declared)`, `CLOCK_RATES = [0.25, 0.5, 1, 2, 4] as const`, `ClockRegistry`,
  `createClockRegistry(shared?: ClockHandle | null)`.
- The registry's `lab` field is renamed `shared`, because the package knows nothing about labs.
- Produces (`@weasel-js/clock/react`): `useClockLoop(registry: ClockRegistry): void`.
- labkit keeps its public names as type aliases (`ClockCapability = ClockSpec`, `TrialClock = Clock`) and keeps
  `ClockRegistryContext`/`TrialClockContext` in `labkit/src/clock/contexts.ts`.

- [ ] **Step 1:** Scaffold the package from `packages/simulation` and register it in every file listed above.
- [ ] **Step 2:** Move the source and tests, renaming as listed. Split `createClock` until every function is ≤120 lines.
  Keep the public getters and setters on `Clock` as they are.
- [ ] **Step 3:** Point labkit and ui at the package. Replace `.lab` with `.shared` at the four call sites
  (`Trial.tsx:168-172`, `storeCommands.ts:112`, `useLabClocks.ts:29`, `hooks.ts:42`).
- [ ] **Step 4:** Run `npx vitest run --project=weasel-ui packages/clock` (find the owning project first with
  `check:test-projects`; add a project glob if no project owns `packages/clock`), then
  `npx vitest run --project=labkit packages/labkit/src/clock packages/labkit/src/lab`. Then run `npm run typecheck`,
  `npm run check:size`, `npm run check:frame-loops`, and `npm run check:test-projects`. Expected: all pass with the
  moved tests unchanged except for imports.
- [ ] **Step 5:** Add a changeset (`patch`, all three packages), then commit: `move labkit's trial clock into
  @weasel-js/clock`.

### Task 2: Clock `origin`, `speed` and `declare`

**Files:**
- Modify: `packages/clock/src/clock.ts` (and its split modules).
- Test: `packages/clock/src/declare.test.ts`.

**Interfaces:**
- Consumes: Task 1's `ClockSpec`, `Clock`, `ClockHandle`.
- Produces:
  - `ClockSpec.origin?: number`, default 0. The time `elapsed` 0 is shown as; display only.
  - `Clock.origin: number`, read-only.
  - `ClockSpec.speed?: number`: the unsigned speed a transport plays a paused clock at. Default `|rate| || 1`.
  - `Clock.speed: number`, read-only.
  - `ClockHandle.declare(spec: ClockSpec): void`: takes up `duration`, `origin`, `loop` and `speed`. The shown time
    (`origin + elapsed`) is kept and clamped to the new run. Play state and rate are left alone. It notifies like a seek.
    This is unlike assigning `duration`, which keeps `phase`.

- [ ] **Step 1: Write the failing tests**

```ts
it('shows elapsed 0 at its origin', () => {
  const { clock } = createClock({ duration: 3000, origin: -1000 });
  expect(clock.origin).toBe(-1000);
  expect(clock.elapsed).toBe(0);
});
it('declare keeps the shown time when the span moves', () => {
  const h = createClock({ duration: 3000, origin: -1000 });
  h.clock.seek(1500); // shows 500
  h.declare({ duration: 3000, origin: 0 });
  expect(h.clock.origin + h.clock.elapsed).toBe(500);
});
it('declare clamps a shown time the new span cannot hold', () => {
  const h = createClock({ duration: 3000 });
  h.clock.seek(2500);
  h.declare({ duration: 1000 });
  expect(h.clock.elapsed).toBe(1000);
});
it('declare leaves a playing clock playing', () => {
  const h = createClock({ duration: 3000, rate: 1 });
  h.declare({ duration: 4000 });
  expect(h.clock.rate).toBe(1);
});
it('a paused clock offers its declared speed', () => {
  expect(createClock({ speed: 2 }).clock.speed).toBe(2);
  expect(createClock({}).clock.speed).toBe(1);
});
```

- [ ] **Step 2:** Run the tests. Expected: FAIL (`origin`, `speed` and `declare` are missing).
- [ ] **Step 3:** Implement. `ClockPosition` stays in elapsed terms, without origin.
- [ ] **Step 4:** Run the tests. Expected: PASS. Run the whole `packages/clock` directory too.
- [ ] **Step 5:** Commit: `give the clock a display origin, a resting speed, and redeclaration`.

### Task 3: Per-registration visibility in the loop

**Files:**
- Modify: `packages/clock/src/registry.ts`, `packages/clock/src/useClockLoop.ts`.
- Test: `packages/clock/src/useClockLoop.test.tsx`. Mock IntersectionObserver as
  `packages/react/src/useVisibleRaf.test.tsx` does.

**Interfaces:**
- Produces:
  - `ClockRegistry.register(id: string, handle: ClockHandle, target?: () => Element | null): () => void`.
  - `ClockRegistry.targets(handle): readonly (() => Element | null)[]`.
- Rule: a clock is gated (out of sight) only when it is not `shared`, every registration of it gave a target, and none of
  those targets intersects the viewport.
- Rule: on every frame it is gated, a clock is skipped and gets `rebase()`, so its first sync on returning only records
  the time. A gated clock does not count as live. When a target starts intersecting again, the loop calls `request()`.
- Page-level hiding is unchanged (`useVisibleRaf`'s `onResume` rebases every clock).

- [ ] **Step 1: Write the failing tests**

```ts
it('freezes a clock whose every target is out of view, and resumes without a jump', ...)
// playing at rate 1; frames at t=0,16; target leaves; frames at 32..2000; target returns; frames at 2016, 2032
// expect elapsed === 32 (16 before leaving + 16 after returning; the first frame back only records the time)
it('never gates the shared clock', ...)      // its trial target leaves view; elapsed keeps advancing
it('gates a clock only when all its registrations are out of view', ...)  // two targets, one visible: keeps running
it('requests no frames while every clock is gated or inert', ...)         // requestFrame spy count stays flat
it('requests a frame when a gated playing clock comes back into view', ...)
```

- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement with one `IntersectionObserver` per loop that observes every registered target.
- [ ] **Step 4:** Run `packages/clock`. Expected: PASS.
- [ ] **Step 5:** Commit: `freeze a registered clock while every view of it is out of sight`.

### Task 4: The transport shows the origin, and labkit exports `useTransportControl`

**Files:**
- Modify: `packages/ui/src/components/Timeline/Transport.tsx`. New prop `start?: number`, default 0. The scrub bar spans
  `[start, start + duration]`, the readout shows the playhead as given, and `onSeek` hands back a time in the same terms.
- Modify: `packages/labkit/src/clock/transportControl.ts`. `playhead` and `seek` work in shown time
  (`origin + time within the pass`), and `start` is `clock.origin`. The resting speed comes from `clock.speed`.
- Modify: `packages/labkit/src/clock/transportHold.ts`. Open at `clock.speed`.
- Create: `packages/labkit/src/clock/useTransportControl.ts`. Move the hold, `useSyncExternalStore` and touch wiring
  out of `TrialTransport.tsx` into it.
- Modify: `TrialTransport.tsx` to use it, and pass `start`. Export `useTransportControl` and `TransportControl` from
  `labkit/src/clock/index.ts`.
- Test: `Transport` tests beside it, `transportControl` tests, `TrialTransport.test.tsx`.

**Interfaces:**
- Produces: `useTransportControl(trialId?: string): TransportControl | null`. It resolves the clock as `useTrialClock`
  does and re-renders on every frame the clock moves. Its `touch` is folded into each action.

- [ ] **Step 1: Write the failing tests:** `Transport` with `start={-500} duration={3000} playhead={-500}` reads `-0.50`
  (or whatever `formatSeconds` gives for -500) and its scrub bar has `min` -500 and `max` 2500. `transportControl`
  over a clock with `origin: -1000`: `playhead` is -1000 at elapsed 0, and `seek(0)` leaves elapsed at 1000.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `--project=weasel-ui packages/ui/src/components/Timeline` and `--project=labkit
  packages/labkit/src/clock`. Expected: PASS.
- [ ] **Step 5:** Commit: `show a clock's origin on the transport, and export useTransportControl`.

### Task 5: `holdAt`, keeping a time a span cannot reach yet

**Files:**
- Create: `packages/clock/src/hold.ts`.
- Test: `packages/clock/src/hold.test.ts`.

**Interfaces:**
- Produces: `holdAt(handle: ClockHandle, shown: number | null): PlayheadHold`, with `PlayheadHold { pending(): number |
  null; release(): void }`.
  - It pauses the clock and seeks to `shown - origin`, clamped. `null` means the span's start.
  - On each later notify caused by `declare` or a `duration` write, it seeks again. It releases itself on any other
    change (a rate change, or a seek it did not make).
  - `pending()` is the held time while the clamped position differs from it, otherwise null.
  - A clock that is not seekable is never held: `holdAt` returns an already-released hold.

- [ ] **Step 1: Write the failing tests:** hold 2500 on `{duration: 1000}` gives elapsed 1000 and `pending()` 2500.
  `declare({duration: 3000})` then gives elapsed 2500 and `pending()` null. Setting `rate = 1` releases the hold, so a
  later `declare` clamps instead. A seek by someone else releases it. `null` follows the span's start across a `declare`
  that moves `origin`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. It tells its own seeks apart by recording the elapsed it set.
- [ ] **Step 4:** Run `packages/clock`. Expected: PASS.
- [ ] **Step 5:** Commit: `hold a clock at a time its span cannot reach yet`.

### Task 6: labkit clocks declared from config

**Files:**
- Create: `packages/labkit/src/clock/useTrialClockSetup.ts`. Move the clock block (`Trial.tsx:161-188`) out of
  `Trial.tsx` into it. `Trial.tsx` must shrink, so lower its entry in `scripts/check-size.allow.json` with
  `npm run check:size -- --update`.
- Modify: `packages/labkit/src/instrument/types.ts`. `clock?: ClockCapability | 'lab' | ((config: C) => ClockCapability
  | null)`.
- Test: `packages/labkit/src/clock/configClock.test.tsx`.

**Interfaces:**
- Consumes: Task 2's `declare`, Task 3's `register(id, handle, target)`.
- Produces: `useTrialClockSetup(args: { instrument, config, record, target: () => Element | null }): ClockHandle | null`.
  - A function `clock` is called with the trial's config on every render. When the result appears, a clock is made
    (reopened from `record.clock`). When it goes to null, the clock is dropped. When its
    `duration`/`origin`/`loop`/`speed` change, `handle.declare(next)` runs.
  - The trial registers its clock with `target` = the trial's root element.
  - On reopen from `record.clock`, a time the first declared span cannot hold is held with Task 5's `holdAt`, so a span
    that grows after mount still reaches it.

- [ ] **Step 1: Write the failing tests** (mounted `Lab`, as in `clock.integration.test.tsx`): a config field
  `seconds` drives `clock: (c) => ({ duration: c.seconds * 1000 })`. Changing `seconds` from 2 to 4 keeps `elapsed`
  and changes `duration`. A function returning `null` gives `useTrialClock()` null, and no transport renders. Flipping
  back to a spec gives a clock again, opened at 0.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `--project=labkit packages/labkit/src/clock packages/labkit/src/trial packages/labkit/src/lab`.
  Expected: PASS.
- [ ] **Step 5:** Commit: `let an instrument declare its clock from config`.

### Task 7: forge runs on the shared clock

**Files:**
- Create: `packages/forge/src/timeline/clockSpec.ts`. `clockSpecOf(spec: TimelineSpec): ClockCapability` returns
  `{ duration, origin: start ?? 0, loop: loop ?? true, speed: rate ?? 1 }`. It opens paused (`rate` omitted).
- Modify: `packages/forge/src/shell/documentInstrument.tsx`. `clock: (config) => story.timeline ?
  clockSpecOf(story.timeline(config)) : null`. The `fg-transport` chrome renders labkit's `TrialTransport`.
- Modify: `packages/forge/src/timeline/context.ts`. `ClockContext` holds a `ClockHandle`. `usePlayhead` subscribes to
  `subscribe` and `onFrame` and returns `origin + elapsed`. `useTimeline` builds `StoryTimeline` from the clock and
  `useTransportControl`:
  - `time` = `origin + elapsed`, `playing` = `rate !== 0`, `loop` = `clock.loop !== false`, `rate` = the control's
    `speed`, and `span` = `{ start: origin, end: origin + duration }`.
  - `seek(t)` → `clock.seek(t - origin)`, and `setRate` → `setSpeed`.
  - `setSpan(o)` keeps an override and calls `declare` with the override or with the declared spec.
- Modify: `packages/forge/src/shell/StoryTrial.tsx`. Read the handle from labkit's `TrialClockContext` through a public
  hook. If none exists, export `useTrialClockHandle` from labkit's `clock/index.ts`; it is the resolver `useTrialClock`
  already uses. Drop `useStoryClock`, `useClockLoop`, the `clocks.publish` effect and `usePersistedPlayhead`.
- Modify: `packages/forge/src/timeline/StoryClock.tsx`. `WithStoryClock` (no `Lab` above) makes `createClock(clockSpecOf(
  spec))` with a one-clock `createClockRegistry` and runs `useClockLoop` from `@weasel-js/clock/react`.
  `CaptureView.tsx` makes the clock and holds it at `payload.playhead`, with no loop.
- Modify: `packages/forge/src/timeline/RoutePlayhead.tsx`. `useTrialClockHandle(trialId)`. `fromUrl` replaces the
  current hold with `holdAt(handle, t)`. `toUrl` skips while `hold.pending() !== null` and writes `null` when playing or
  at `origin`.
- Modify: `packages/forge/src/shell/Workshop.tsx`. Remove `TrialClocksContext`.
- Delete: `timeline/clock.ts`, `clock.test.ts`, `trialClocks.ts`, `useClockLoop.ts`, `TransportBar.tsx`,
  `usePersistedPlayhead.ts`. Port any test of `clock.test.ts` that pins a forge-visible behavior to `timeline.test.tsx`.
- Modify: `packages/forge/src/index.ts`. The exports keep their names (`TimelineSpec`, `TimelineSpan`, `SpanOverride`).
- Persistence: retire `$playhead`; the position lives in labkit's `record.clock`.
  - Remove the schema field (`documentInstrument.tsx:29`).
  - Keep `PLAYHEAD_KEY` in `FORGE_KEYS` (`globals.ts:60`) so a saved config holding it is stripped and never reaches a
    story.
  - `capturePayload` takes `playhead: number | null` as input. Its caller fills it from the trial's clock: shown time
    when paused, else null.
  - Update `capturePayload.test.ts` and `globals.test.ts`.

- [ ] **Step 1:** Make `timeline.test.tsx`, `timeline.browser.test.tsx` and `playheadUrl.test.ts` pass against the new
  wiring before deleting anything. They pin forge's behavior. Add the Review Focus tests:
  - A story whose `timeline` disappears on edit loses its transport.
  - `?t=2500` with a span set to 3000 by `setSpan` after mount lands at 2500.
  - A config holding `$playhead: 1200` opens without the key reaching `useStory().config`.
  - The `Playhead.stories.tsx` story with `start: -1000` shows `-1.00` at rest.
- [ ] **Step 2:** Run `npx vitest run --project=forge packages/forge/src/timeline packages/forge/src/shell`. Expected:
  the new tests FAIL.
- [ ] **Step 3:** Implement and delete.
- [ ] **Step 4:** Run the same command, plus `--project=browser packages/forge/src/timeline`, `npm run typecheck`,
  `npm run check:size` and `npm run check:frame-loops`. Expected: PASS.
- [ ] **Step 5:** Commit: `run forge stories on the shared clock and delete forge's own`.

### Task 8: Record the follow-on and land the branch

**Files:**
- Modify: `docs/TODO.md`. Add one entry per engine (`animator`'s `useAnimator`, `simulation`'s `useSimulation`,
  `diagram`'s `useEffectRunner`): run it on `@weasel-js/clock` so it can be paused and scrubbed. Grep for an existing
  clock entry first and rewrite it rather than adding a second.
- Modify: `packages/clock/README.md`. What the package is, the two entries, and the visibility rule.
- Delete: this plan.

- [ ] **Step 1:** Write the TODO entries and the README.
- [ ] **Step 2:** On the branch, run `npm run test:fleet`, `npm run test:gate` and `npm run test:fleet:postbuild`, each
  with its own log file named for the branch. Expected: green, and the log shows
  `fleet-tree: N changed path(s) match <sha>`.
- [ ] **Step 3:** Delete the plan, commit, and merge to `main`. Run `npm run test:fleet` on `main` in the background.
