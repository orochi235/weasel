# Audit round 54, area `react` — findings

Note: the brief names frozen commit 608f35f5258a05f095a34c54f949616c26b75022, which is not an object in this
clone (`git cat-file` reports "bad object"); HEAD is 830b463cc1. Read at HEAD; nothing under packages/react/src
shows as modified in the working tree status given at session start.

## A target that leaves the document suspends a running loop, and nothing resumes it until someone calls `request()`
- where: packages/react/src/useVisibleRaf.ts:158-161 (IntersectionObserver callback) and :109-119 (syncObserver)
- scenario: a continuous loop (e.g. `useElapsed({ target })`, which requests only on mount and from its own frame)
  gates on an element that is removed or swapped for a new one (a keyed remount of the canvas). The observer
  reports the old element as not intersecting, `intersectingRef` goes false and `syncGate` suspends the loop.
  `syncObserver`, whose own comment says "an element that has gone away stops gating rather than stopping the
  loop", only runs from `request()`; a suspended continuous loop runs no frame, so it never requests, and stays
  stopped even though the new element is fully on screen. Expected: the loop keeps running (or re-resolves the
  target) when its element goes away.
- evidence: read
- severity: medium

## watchElementMove frames an unclipped element against the implicit root, which inside an iframe is the top-level viewport
- where: packages/react/src/watchElementMove.ts:168-171 (frame) with marginAround :38-47
- scenario: an element in a same-origin iframe (a Storybook story, a demo embedded in a page) with no clipping
  ancestor gets `root: null`. The implicit IntersectionObserver root is the top-level browsing context's viewport,
  but `marginAround` builds the margin from the iframe document's `clientWidth`/`clientHeight` and the box in the
  iframe's own client coordinates, so the frame lands offset by the iframe's position in the parent page instead of
  exactly around the box. The element then reads as partly or wholly outside its frame: moves that keep that
  overlap unchanged are missed, and a box wholly outside falls into the 1 s polling path. (In a cross-origin
  iframe `rootMargin` is ignored for the implicit root altogether.) `useNearViewport` avoids this by passing
  `root: doc` explicitly; this file answers the same question the other way.
- evidence: read (reasoned from the IntersectionObserver spec's implicit-root rules; not run)
- severity: medium

## A loop given `requestFrame` without `cancelFrame` cancels the page's real animation frames by the injected clock's ids
- where: packages/react/src/scheduledFrame.ts:81 (cancelRaf) and :98 (fire, early run)
- scenario: `useVisibleRaf(frame, { requestFrame: myClock })` with a clock returning small ids 1, 2, 3 and no
  `cancelFrame`. On `cancel()`, unmount, suspension, or whenever an update/paint loop is run early, the hook calls
  the global `cancelAnimationFrame(id)` with the injected clock's id, which can cancel an unrelated real frame
  holding the same number in another loop. The option is documented as "Read live, so a test may inject one",
  with no word that the two must be passed together. The stale-callback guard at :95 already makes the cancel
  unnecessary for correctness, so falling back to the global cancel for a foreign clock only does harm.
- evidence: read
- severity: low

## leakProbe reports a timer cleared by the other kind's clear function as still live
- where: packages/react/src/testing/leakProbe.ts:165-172 (watchTimer's clear replacement)
- scenario: code calls `clearTimeout(intervalId)` (or `clearInterval(timeoutId)`), which every browser and Node
  honor since the two share one id pool. `realClear` really stops the timer, but the `p.rec.kind === kind` check
  keeps the record, so `live()` lists an interval/timeout that no longer exists and a teardown test fails on a
  phantom leak.
- evidence: read
- severity: low

## leakProbe counts a listener added with an already-aborted signal as live forever
- where: packages/react/src/testing/leakProbe.ts:118-133 (addEventListener replacement)
- scenario: `window.addEventListener('keydown', fn, { signal })` where `signal.aborted` is already true. The real
  `add` registers nothing, but the probe records the listener and subscribes to `abort`, which never fires again,
  so the record stays held (window is always reachable) and a teardown test reports a listener that was never
  registered. Should skip recording when `opts.signal?.aborted`.
- evidence: read
- severity: low

## actSettled's release puts back the frame functions it saw on entry, undoing any stub installed inside it
- where: packages/react/src/testing/renderSettled.tsx:60-62 (holdFrames release)
- scenario: a test runs `vi.stubGlobal('requestAnimationFrame', fake)` (or installs leakProbe) inside the `fn`
  passed to `actSettled`/`renderSettled`. On release, `scope.requestAnimationFrame = request` restores the
  pre-entry function, silently removing the test's stub for the rest of the test (and `vi.unstubAllGlobals`
  later restores to the wrong original). Should only restore if the current value is still the wrapper it set.
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
