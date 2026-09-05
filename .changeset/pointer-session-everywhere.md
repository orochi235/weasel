---
"@weasel-js/core": patch
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

Put every drag in the kit on one pointer lifecycle, and recover the releases the DOM does not deliver.

Fourteen pointerdown-to-pointerup lifecycles each answered capture, pointer identity, teardown and lost-pointer recovery for themselves. They now run on `openPointerSession`: `Slider`, `BandEditor`, `Timeline`'s `Lane` and `Ruler`, `LayeredCurveEditor`, `ResizeHandle`, `useReorderDragList`, `MinimapCanvas`, labkit's `LayerList`, `usePanZoom`, `useOrbit` and `FloatingPanel`. A drag released over another window, or whose element unmounts mid-gesture, now ends instead of hanging in flight.

A third recovery rule joins the two that shipped with the primitive: a fresh press on a pointer still believed held reports `'superseded'`, because the release landed somewhere that never told us and the pointer never came back for the missed-release rule to see. Without it a stale session steers the next press. `useGestureDispatcher` applies the same rule to its own multi-pointer lifecycle.

Breaking: hooks that drove their drag through returned React props no longer return them, because the session owns the gesture from the press.

- `useReorderDragList`'s `containerProps` is `{ ref }` only; `onPointerMove` / `onPointerUp` / `onPointerCancel` are gone. It gains `onPress(id, mods)` — a press released without engaging a drag, fired for locked rows too, with the modifiers held at press. That is the click-vs-drag decision consumers previously had to reconstruct by sampling drag state before forwarding the pointerup, which no longer works now that the session ends first.
- labkit's `PanZoomHandlers` and `OrbitHandlers` lose `onPointerMove` / `onPointerUp`. `usePanZoom` gains `onTap` for the same reason.

The five `@weasel-js/ui` drag surfaces pass `capture: false` deliberately and now assert it: capture retargets `pointerup` to the capture element and kills the click on consumer-rendered content inside a slider thumb, a band body, or curve-editor chrome.
