# Audit round 70 — area `react`, blind reviewer

## A loop gated on a target stays suspended for good when that target is removed while offscreen
- where: packages/react/src/useVisibleRaf.ts:113 (syncObserver), :163 (observer callback), :186 (per-render syncGate)
- scenario: a loop has `target` set and a request pending. Its element is out of view, so `intersectingRef` is false and the loop is suspended. Some other component then removes the element (a child re-renders, or imperative DOM code runs), and the host does not re-render. An element that was already not intersecting gets no new IntersectionObserver entry when it leaves the document, so nothing calls `syncObserver`/`syncGate`. `resolveTarget` would now answer null, and line 120 says a vanished element "stops gating rather than stopping the loop". Instead the loop stays suspended and the held request never runs, until a host render, a `visibilitychange` or a new `request()` happens to re-read the gate. The stated rule only holds when the host happens to re-render.
- evidence: read (inference about IO not reporting removal of an already-non-intersecting target)
- severity: low

## A stale IntersectionObserver entry delivered after unmount calls the consumer's `onSuspend`
- where: packages/react/src/useVisibleRaf.ts:163-169 with :128-135 (syncGate)
- scenario: the layout-effect cleanup disconnects the observer, but entries queued before `disconnect()` still arrive (this repo says so in watchElementMove.ts:76 and useNearViewport.ts:24). If the document is hidden when such an entry lands, the callback runs `syncGate()`. Its suspend branch has no `aliveRef` guard, so `suspendedRef` is not yet set: it sets `suspendedRef = true`, cancels, and calls `optsRef.current.onSuspend?.()` on a component that has already unmounted. Under StrictMode's simulated remount, the stray `suspendedRef = true` also makes the next `request()` fire a spurious `onResume`. The resume branch checks `aliveRef` (line 139), but the suspend branch does not.
- evidence: read
- severity: low

## `useNotified` passes no server snapshot, so it throws in a server render, unlike its siblings
- where: packages/react/src/useNotified.ts:24 (useNotified)
- scenario: `useSyncExternalStore(subscribe, getSnapshot)` is called without a third argument. React's server renderer errors with "Missing getServerSnapshot" for any component using `useNotified` rendered with `renderToString`/streaming SSR. The package treats a server render as a supported case elsewhere: `useMediaQuery` (media.ts:35) and `useKitSetting` (useKitSetting.ts:43) both pass a server snapshot, and `colorScheme.ts` documents server-render behavior. So the package answers "does this hook work on the server" two different ways. Passing the same `() => count?.n ?? 0` (or `() => 0`) as the server snapshot fixes it.
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

<!-- done: 3 findings, files read: 31 -->
