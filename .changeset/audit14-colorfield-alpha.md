---
'@weasel-js/ui': patch
---

`ColorField` keeps a color's exact alpha through an edit of its hue. It used to round the alpha to the opacity slider's whole percents, so recoloring `#11223302` wrote `#44556603`.
