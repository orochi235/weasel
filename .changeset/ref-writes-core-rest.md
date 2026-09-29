---
"@weasel-js/core": patch
---

Core's hooks outside the canvas no longer write refs during render, so a render
React abandons (a transition that suspends) can no longer leave its options,
adapter or callbacks behind for the next event or frame to use. Mirrors now go
through `useLatest`. A few hooks change shape where something read the ref
during render:

- `useSelection` keeps a local selection in an internal store, so writes are
  synchronous and no longer deferred inside a transition. The returned object
  is now stable only for as long as `scene` is the same store.
- `useDragRect` and `useDragRadial` return `overlay` and `isActive` as values,
  so the controller gets a new identity when the overlay changes; its methods
  stay stable.
- `useArrayAdapter` builds its adapter over that render's `items` instead of a
  ref.
- `useSimulation` starts its loop in a layout effect on mount rather than during
  render, and restarts it after StrictMode's simulated remount.
- `useCanvasFocus` returns a `focusProps` object that is stable until `tabIndex`
  changes; it used to be new every render.
