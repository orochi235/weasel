---
'@weasel-js/ui': patch
---

`RangeSlider` follows its computed `direction`, as `Slider` does, rather than taking it from the locale: in a right-to-left page its values run from the right end and ArrowRight steps down whatever the locale, and in a left-to-right page with a right-to-left locale they run from the left. Its fill now runs from the start of its track in either direction. It keeps the locale's digits.
