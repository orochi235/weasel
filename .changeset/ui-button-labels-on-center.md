---
'@weasel-js/ui': patch
---

`Button` and `MenuButton` labels center their capitals on the button's middle, level with its icons.

A label was centered by its line box, so in a face with more ascent than descent, Oswald among them, its capitals sat about half a pixel below the icon beside them. Browsers without `text-box` (Firefox, for now) still lay it out the old way.

<!-- entry: visual -->
