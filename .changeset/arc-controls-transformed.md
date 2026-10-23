---
"@weasel-js/ui": patch
---

`Along` and the controls laid along it work under a scaled or rotated ancestor. `Along` sizes its arc from its untransformed box, so a CSS scale no longer shrinks the arc a second time, and a curved `Slider` and a scrolling curved `Bar` map a pointer back through every transform above them, so a press under a rotated or scaled ancestor lands where it was made.
