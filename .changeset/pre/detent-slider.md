---
'@weasel-js/ui': patch
---

Add `DetentSlider`, and make `Slider`'s stops visible.

A numeric option with a small set of allowed values along a line is a slider
with detents, not a dropdown. `DetentSlider` takes `items`/`value`/`onChange`
the way `ToggleBar` does — it is that same "pick one of an ordered set", wearing
a slider's affordance — and the transport's playback rate now uses it.

The track addresses the *index* of `items`, not the value. Rate steps are
geometric, so a linear value track puts 1× at a fifth of the way along and
crowds four of five detents into that fifth, making the most-used value the
hardest to hit. A log scale would rescue that particular list by coincidence
and not a 1-2-5 one. Index-addressing is also the honest model: a small allowed
set is an ordinal choice with nothing between the detents to represent. The
value is published as `aria-valuetext`, since `aria-valuenow` is then a
position rather than a quantity.

Three changes to `Slider` fall out and are generally useful: `stops` now draw
(an invisible attractor that changes drag and keyboard behaviour is
indistinguishable from a bug — `showStops: false` opts out); `Thumb.valueText`
fills `aria-valuetext` for any non-linear scale; and `trackClick:
'move-nearest'` makes a press on bare track move the nearest thumb, off by
default so a stray click cannot yank a stop on a multi-thumb gradient.
