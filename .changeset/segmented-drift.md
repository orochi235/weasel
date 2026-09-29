---
"@weasel-js/ui": patch
---

`ButtonBar` and `OptionsBar` pick up three layout fixes `ToggleBar` already
had. Segments no longer collapse or clip their labels in a squeezed row, or
when one label is longer than the others; a tooltip on an end segment no longer
squares off its end cap; and an icon-only segment pads its glyph by 5px a side
(3px at `size="sm"`) instead of the text padding. Their `height` prop, which
had no effect, now sets the bar's height the way it does on `ToggleBar`.
Not breaking, but bars with a long label or an icon now render at a different
width than before.
