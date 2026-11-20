## `<MinimapCanvas>`'s `rootView.get()` does not see its own `set` until React re-renders, so back-to-back zoom samples don't add up
- where: packages/minimap/src/useMinimapInput.ts:36-47 (useMinimapInput, `rootView`)
- scenario: `rootView.get` reads `mainViewRef`, a `useLatest` of the `mainView` prop that only updates in an insertion effect after the parent re-renders with the new view. `set` calls `onMainViewChange` and nothing else. Wheel, pointermove and touch events are continuous-priority in React, so their state updates render in a scheduler task, not before the next event. Two wheel samples (or two `minimap.touchZoom` moves) dispatched before that render both run `zoomedAbout(root.get(), …)` on the same base view: the second overwrites the first, and the main view zooms by `f` instead of `f²`. The pinch's translation (`zoomed.x + next.x - at.x`) also restarts from the stale base. The pan's post-pinch rebase (`centerOf(root)`, actions.ts:99) can read a stale center the same way. Inside the contribution, `rootView` is the surface's live view dep (`useSceneStandardActions.ts:157`), so the same actions give different results in the two hosts the README says they share. `rootView` should remember the last view it set until the prop catches up.
- evidence: read (React scheduling inferred, not run)
- severity: medium

## A two-finger touch pinch that starts at spread 0 does nothing for its whole length, pan included
- where: packages/minimap/src/actions.ts:160-169 (createMinimapTouchZoomAction, start/onMove)
- scenario: `spread` starts at `mt.spread`. If that is 0 (both touches reported at the same CSS pixel at recognition), the guard `!(spread > 0)` returns on every move before `spread = p.currentSpread` and `at = next` run. The value can never recover, so the pinch neither zooms nor pans. `pinching` still holds the root, so a pan that is running also stays still until the fingers lift. Core's `viewport.touchZoom` falls back to 1 here instead. The fix is to rebase `spread` (and `at`) on the first positive `currentSpread` instead of returning.
- evidence: read
- severity: low

## `useFitView` refits on every render after an override publish or a scroll, even under a `"scene"` fit that reads neither
- where: packages/minimap/src/useFitView.ts:20-35 (useFitView)
- scenario: In the non-live case, the subscribe argument is `NEVER`, but `getSnapshot` is still `scene.overrides.getGeneration` / `scene.scroll.getGeneration`. React calls `getSnapshot` on every render, so after any override publish (a drag or settle on the main canvas) or any scroll, the next render returns a new generation. That changes the `useMemo` deps and reruns `computeFitView`, a sweep of every leaf. `<MinimapCanvas>` re-renders on every pointer move (`usePointerPosition`), so during a main-canvas drag the `"scene"` fit is recomputed on each move. Each recompute also gives `fitView` a new identity, which rebuilds the indicator and cursor commands and hands `<SceneViewCanvas>` a new view. The doc says only a `"live"` fit tracks these counters, and `createMinimapContribution`'s `fitCamera` gets that right by using 0 when `fit !== 'live'` (createMinimapContribution.ts:149-150). The non-live snapshot should be a constant.
- evidence: read
- severity: low

## Files read
packages/minimap/src/MinimapCanvas.tsx
packages/minimap/src/actionParamSchema.ts
packages/minimap/src/actions.ts
packages/minimap/src/createMinimapContribution.ts
packages/minimap/src/index.ts
packages/minimap/src/layers.ts
packages/minimap/src/minimapMath.ts
packages/minimap/src/pbt.fixture.ts
packages/minimap/src/useFitView.ts
packages/minimap/src/useMinimapInput.ts

<!-- done: 3 findings, files read: 10 -->
