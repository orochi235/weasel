# Audit round 54 — area `react` (blind reviewer)

## A synchronous frame clock leaves the loop holding a dead handle, so it never runs again
- where: packages/react/src/scheduledFrame.ts:116-117 (useScheduledFrame → scheduleRaf)
- scenario: `useVisibleRaf(frame, { requestFrame: (cb) => { cb(performance.now()); return 1; } })`, a clock that runs its callback inside the call (an export or test driving frames itself; `fire` even guards `handle !== null` for exactly this case). `fire` runs the frame and sets `rafRef.current = null`, then `clock()` returns and line 117 sets `rafRef.current = handle` for a callback that has already run. Every later `request()` sets `pendingRef` and returns at `if (rafRef.current !== null …) return`, so the loop is dead after its first frame. It should leave `rafRef` null when the callback already fired (a `fired` flag in `fire`, skipping the assignment and the due-set entry).
- evidence: read
- severity: low

## Cancelling a frame from an injected `requestFrame` with no `cancelFrame` cancels an unrelated window frame
- where: packages/react/src/scheduledFrame.ts:83, 97 (cancelRaf, fire's early path)
- scenario: a loop passes `requestFrame: xrSession.requestAnimationFrame.bind(xrSession)` (or any clock of its own) and no `cancelFrame`. `cancelRaf` and the early-run path call `(optsRef.current.cancelFrame ?? cancelAnimationFrame)(rafRef.current)`, i.e. `window.cancelAnimationFrame(<handle from the other clock>)`. Handles are small integers in both, so this cancels whichever window rAF has that number, and another component's frame silently never runs. The cancel also reads `optsRef` live rather than using the clock the frame was scheduled on, so a `requestFrame` swapped after scheduling pairs the new canceller with the old clock's handle. It should cancel with the canceller paired with the clock captured in `scheduleRaf`, and not fall back to `cancelAnimationFrame` for a non-default clock.
- evidence: read
- severity: low

## A loop suspended by an offscreen target stays frozen after the target is swapped for a visible element
- where: packages/react/src/useVisibleRaf.ts:117-128, 152-156 (syncObserver, syncGate, observer callback)
- scenario: a loop with `target: ref` is running. Element A scrolls out of view, IO reports not intersecting, `syncGate` suspends and the request is held. The component then re-renders pointing `ref` at element B, which is on screen (or A is unmounted and replaced). The target is re-resolved only in `request()` (via `syncObserver`), but a suspended loop runs no frames, so nothing calls `request()`. The observer still watches A (or a detached A, which reports not intersecting), `intersectingRef` stays false, and the held frame never runs. The `VisibleRafTarget` doc says the target is "resolved every time the gate is consulted", but `syncGate` (run on `visibilitychange` and on IO reports) never resolves it. It should re-resolve the target in `syncGate` or on commit, not only in `request()`.
- evidence: read
- severity: medium

## useNearViewport never observes an element that mounts after the hook's effect, or one that replaces it
- where: packages/react/src/useNearViewport.ts:13-15 (useNearViewport effect)
- scenario: `const ref = useRef(null); const near = useNearViewport(ref, '200px', false); return loaded ? <div ref={ref}>…</div> : null;`. The effect runs once with `ref.current === null` and returns. Its deps are `[ref, margin]`, both stable, so when `loaded` turns true and the div mounts, nothing observes it and `near` stays `false` forever (content gated on it never mounts). The same happens when the ref later points at a different element: the old one stays observed. `useVisibleRaf` handles exactly this ("Ref callbacks and lazily-mounted hosts fill their refs after this hook's effect has run"); this hook does not. It should re-check `ref.current` (e.g. an effect without deps comparing it to the observed element) or accept a callback ref.
- evidence: read
- severity: medium

## leakProbe misses a `once` listener's removal when the event's propagation is stopped, and records listeners an already-aborted signal never added
- where: packages/react/src/testing/leakProbe.ts:130-132 (watchListeners → addEventListener patch)
- scenario: (1) `el.addEventListener('click', h, { once: true })` where `h` calls `event.stopImmediatePropagation()`. The browser removes `h`, but the probe's own `drop` listener was added after it on the same target and phase, so it never runs and the record stays: a teardown test reports a leak that does not exist. (2) `addEventListener(type, cb, { signal })` with `signal.aborted` already true. The browser adds nothing, but the probe records it and waits on an `abort` event that has already fired, which is a permanent false leak. It should drop the record when `signal.aborted` is true at add time, and detect a `once` firing by wrapping the callback rather than by adding a second listener.
- evidence: read
- severity: low

## leakProbe keeps a timer live when it is cleared with the other clear function
- where: packages/react/src/testing/leakProbe.ts:165-171 (watchTimer's clear patch)
- scenario: browsers and jsdom share one id pool, and `clearTimeout(intervalId)` / `clearInterval(timeoutId)` cancel the timer. The patch calls the real clear, so the timer is gone, but drops the record only when `p.rec.kind === kind`. A component that stops its interval with `clearTimeout` (or the reverse) leaves an `interval` record forever, and the teardown test reports a leak; the entry also stays in `pending`. It should drop the record whichever kind the id belongs to.
- evidence: read
- severity: low

## Files read
packages/react/src/adoptCss.ts
packages/react/src/assignRef.ts
packages/react/src/colorScheme.ts
packages/react/src/copyText.ts
packages/react/src/index.ts
packages/react/src/kitSettings.ts
packages/react/src/media.ts
packages/react/src/pageStorage.ts
packages/react/src/pbt.fixture.ts
packages/react/src/reducedMotion.ts
packages/react/src/scheduledFrame.ts
packages/react/src/test-seams.ts
packages/react/src/testing/abandonRender.tsx
packages/react/src/testing/baselineOf.ts
packages/react/src/testing/domResidue.ts
packages/react/src/testing/giveKeys.ts
packages/react/src/testing/leakProbe.ts
packages/react/src/testing/renderSettled.tsx
packages/react/src/testing/stubMatchMedia.ts
packages/react/src/useCanvasFocus.ts
packages/react/src/useElapsed.ts
packages/react/src/useKitSetting.ts
packages/react/src/useLatest.ts
packages/react/src/useLatestOnly.ts
packages/react/src/useNearViewport.ts
packages/react/src/useNotified.ts
packages/react/src/useStableByContent.ts
packages/react/src/useVisibleRaf.ts
packages/react/src/useWindowEvent.ts
packages/react/src/watchElementMove.ts
packages/react/src/watchResize.ts

<!-- done: 6 findings, files read: 31 -->
