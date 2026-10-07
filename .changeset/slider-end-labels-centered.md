---
'@weasel-js/ui': patch
---

`Slider`'s first and last stop labels (and so `DetentSlider`'s) now center on their stops like the others, and move inward only as far as needed to stay inside the track. They used to be pinned flush to their stop, so a short end label sat visibly off its tick.
