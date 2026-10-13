---
'@weasel-js/ui': patch
---

`ColorField` reads a value written as `rgba()`, `hsl()`, or a color name, and shows it in the picker and the opacity slider as the color it names. It used to hand the native input the first seven characters of the string (`rgba(20`), which the browser refused with a console warning and drew as black. A color it cannot read, such as `rgb(from …)` or `oklch()`, is shown as black with no warning.
