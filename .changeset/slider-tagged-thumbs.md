---
'@weasel-js/ui': patch
---

Adds API: a `Slider` thumb's `value` may be a tagged quantity (`Thumb<Tagged>`), as a `BandEditor` band's `from` may. The thumb is placed by its amount, its readout and `aria-valuetext` go through its own display where it carries one, over the slider's `display`, and `onInput`, `onChange`, `keyStep`, and `renderReadout` get it back with its unit and display around the new number. A bare number stays bare, and the two may sit on one track. A `bounds` function still reads bare amounts.

`Thumb` takes the value's type as a parameter that defaults to `number`, so existing code reads as before.
