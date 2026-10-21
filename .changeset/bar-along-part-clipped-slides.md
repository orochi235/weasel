---
"@weasel-js/ui": patch
---

A curved `Bar` scrolled so an item hangs partly past an end of its run now draws that item sliding on past the end,
along the run's end direction. It used to stop at the end with its middle there, sitting up to half its length out of
place and closing the gap to its neighbor until it was scrolled wholly past and hidden.
