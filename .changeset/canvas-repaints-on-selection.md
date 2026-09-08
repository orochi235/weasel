---
'@weasel-js/core': patch
---

A bare `<Canvas>` now repaints when its selection changes, without a wrapper
asking it to.

The redraw tripwire — the layout effect whose dep array is meant to name every
paint input that arrives on a render — did not name the overlay-aware state the
layer helpers expose. Selection, preview poses and the chrome derived from them
were written during render into a ref, so changing the selection prop repainted
nothing. It looked correct only because `<SceneCanvas>` calls `requestRedraw()`
by hand for its own data sources.

The tripwire now carries the memoized chrome state, which re-derives on exactly
the selection, bounds and preview inputs the helpers read, plus the chrome-caps
predicate. A render that changed none of them still paints nothing.
