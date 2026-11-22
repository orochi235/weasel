# Audit round 70 — area `react`

## useVisibleRaf's IntersectionObserver callback acts after unmount: fires `onSuspend` on a dead loop and leaves `suspendedRef` set
- where: packages/react/src/useVisibleRaf.ts:163-169 (observer callback in the arming layout effect), with cleanup at 172-182
- scenario: the cleanup disconnects the observer and resets `suspendedRef` to false, but entries already queued before `disconnect()` are still delivered. The repo relies on that elsewhere: watchElementMove.ts:76 and useNearViewport.ts:24 both guard against it. Here the callback has no `aliveRef` check. It calls `syncGate()`, which reads `intersectingRef` (reset to true) and `document.hidden`. If the tab is hidden when the queued report lands, `syncGate` sets `suspendedRef = true`, calls `cancelRaf()`, and calls `optsRef.current.onSuspend?.()` on a loop that has already unmounted. Under StrictMode's simulated remount (refs survive), the leftover `suspendedRef = true` then makes the next visible `syncGate` call `onResume` with no suspension before it. For `useElapsedRaf` that wrongly rebases the clock. The callback should return early when `!aliveRef.current`, or when the reporting observer is not `observerRef.current`.
- evidence: read
- severity: low

## leakProbe leaves its own `once` drop-listener attached when the listener is removed by hand before it fires
- where: packages/react/src/testing/leakProbe.ts:132 (watchListeners → watching)
- scenario: code calls `window.addEventListener('keydown', h, { once: true })`, then `window.removeEventListener('keydown', h)` before any keydown. `unwatching` drops the entry, but the helper `() => drop(target, entry)` that the probe added with the real `add` stays on `window` until a keydown fires. A test file that mounts and unmounts such a component many times piles up untracked listeners on `window`/`document`, the very thing the probe exists to catch, and `restore()` does not remove them. `unwatching` should also remove the helper, for example by keeping it on the `Entry`.
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

<!-- done: 2 findings, files read: 31 -->
