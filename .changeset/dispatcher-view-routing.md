---
'@weasel-js/core': patch
---

Route each input event to the view it landed in, inside `useGestureDispatcher`.

The hook takes an optional `views` — a thunk returning the non-root dispatch
records and a resolver that names one for a client point. `createViewResolver`
satisfies the resolver shape, so a canvas holding several viewports can hand
the two straight over. Pointerdown pins its pointer to the view it began in and
pointerup releases it, so a drag that leaves a panel keeps reporting
coordinates in the camera it started under. Keyboard and paste carry no
coordinates and run on the view the last coordinate-bearing event resolved to.
A resolved id with no live record falls back to the root, so a view that
unmounts mid-gesture degrades rather than dropping the event.

No public change, and no change at all with `views` omitted: every event then
runs on the record the flat options describe. Cancelling in-flight gestures —
on unmount and on tool change — now reaches every view's dispatcher rather than
only the root's.
