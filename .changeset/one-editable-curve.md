---
"@weasel-js/ui": patch
---

`<Timeline>`'s graph mode now runs on `LayeredCurveEditor` instead of its own
sampled polyline, DOM handles and drag code, so the kit has one editable-curve
substrate rather than two.

**`createKeyframeLayer` is a new built-in layer.** It edits a list of
`Keyframe<number>`: model x is time, model y is value, and each segment is
drawn through the easing on the key it runs into. You can drag keys, with the
committed key held in place and a ghost at the target. A dragged key snaps to
`snapX` (hold alt to skip it) and stays inside `xClamp`/`yClamp`. Clicking the
curve selects a segment, and a selected cubic-bezier segment shows two
draggable handles. Every key, segment and handle can take focus and has an
accessible name. The arrow keys move whichever one has focus, and Enter or
Space selects it. `keyframeLayerState` and `applyKeyframeDrag` are exported
alongside it.
`createFunctionLayer` still interpolates a spline through its anchors; the two
layers solve different problems and do not share curve maths.

**Keyboard edits reach the layer contract.** `CurveLayer.onKeyDown` now gets a
fourth argument, `{ commit }`, so a key press can publish an edit that goes
through `onLayerCommit` and undo like a drag does. Existing three-argument
implementations are unaffected. `LayeredCurveEditor` now checks the native
event's `defaultPrevented` to stop the key reaching lower layers. Before, it
read a synthetic flag that a layer's `preventDefault` never set, so every key
reached every layer.

**`createFunctionLayer` anchors are focusable and named.** Each movable
anchor has `tabIndex={0}`, `role="button"` and an accessible name built from
the new `label` option (default `'Point'`). The arrow keys move a focused
anchor by 1% of the range, or 10% with shift, under the same constraints as a
drag. This applies to `CurveEditor` too.

**`Plot2D` takes `role` and `aria-label`.** The default role stays `'img'`.
`LayeredCurveEditor` renders its plot as `role="group"`, because an image's
children are hidden from assistive technology and its marks are now
interactive. It also accepts `aria-label`.

`snapToNearest` is exported; `Timeline`'s snapping uses it.

In graph mode, a key's value is no longer clamped to the lane's current value
range while you drag it, so a drag can raise the maximum or lower the minimum.
Graph lanes draw vertical grid lines at the ruler's ticks.
