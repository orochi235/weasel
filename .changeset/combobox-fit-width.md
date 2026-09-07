---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`ComboBox` takes `width='fit'`, and labkit's zoom field stops pinning pixels.

`Select` and `NumberField` already had it; `ComboBox`'s text input did not, so
the only way to keep one out of a toolbar's slack was a pixel width from the
consumer's own stylesheet. At `fit` the input measures a hidden stack of every
option label — the same mechanism `Select` uses — so the field is wide enough
for whichever option is chosen and takes no more of the row than that.

labkit's `ZoomControl` states `--wzl-number-field-width: 6ch` instead of pinning
its field at 62px. Measured in a browser: "800%" is 33px against the 35px a 5ch
box gives, which is no margin at all in another UI font, and 6ch also holds the
"1600%" a consumer raising `max` can reach.
