---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Sliders take a press a few pixels past their track, and `Slider`'s and `RangeSlider`'s thumbs take one a few pixels past their edge, so a thin track or a small thumb no longer has to be hit exactly. Two new tokens set the distances: `--wzl-slider-track-slop` and `--wzl-slider-thumb-slop`, both 6px. Nothing moves or repaints; the extra area is invisible and overlaps whatever sits beside the control.

`Slider` (and so `DetentSlider`) and `RangeSlider` draw both. A thumb's slop sits over the track's, so a press near a thumb grabs it instead of jumping the value to the pointer. The native range skin — `InlineRange`, a `PropertyField` slider, a color field's alpha, and labkit's bare ranges — takes the track slop only, because a native thumb re-centers on the pointer wherever a press lands.

The skin now sets `box-sizing`, `width`, `height`, `padding` and `margin` on the input to make room for it. A consumer rule that overrides `margin` or `padding` on one of these inputs cancels the slop and makes the box 12px wider and taller.
