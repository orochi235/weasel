---
'@weasel-js/core': patch
---

Fix pinch-to-zoom: mac trackpads zoomed the page, and `viewport.pinchZoom` zoomed twice

A trackpad pinch reaches the page as `wheel { ctrlKey: true }`. On a mac
`viewport.zoom`'s `mods: { mod: true }` binding requires metaKey and forbids
ctrl, and `viewport.wheelPan` forbids ctrl too, so nothing claimed the event
and the browser's own ctrl+wheel page zoom ran. `viewport.zoom` now carries a
second wheel binding on bare ctrl. Off mac it duplicates the `mod` binding,
where the matcher picks a single winner.

Nothing caught that because `IS_MAC` read `navigator.platform ?? userAgent`,
and jsdom reports an empty-string platform — not nullish, so the fallback never
fired and every mac binding in the kit was exercised only on the non-mac
branch. It reads `||` now.

Separately, `viewport.pinchZoom: true` mounted `<Canvas>`'s `usePinchZoomTool`
alongside the `viewport.pinchZoom` action that already handled the same
gesture, applying one pinch's factor twice — the opt-in broke the path that
worked without it. SceneCanvas drives pinch through the action alone, and the
flag configures it: new `makePinchZoomAction({ min, max })` (exported), with
the kit's 0.1–8 clamp now applied by default. `pinchZoom: false` disables pinch
for real; it previously left the action running. Bare `<Canvas>` keeps the hook
as its own pinch path.
