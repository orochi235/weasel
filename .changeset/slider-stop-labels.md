---
'@weasel-js/ui': patch
---

`Slider` stops can now carry labels: pass `{ value, label }` in `stops` alongside bare numbers, and the label is drawn under the stop. `stopLabels: 'ends'` shows only the first and last, `'none'` hides the row. `DetentSlider` now draws its detent labels through this row instead of its own, so the `data-detent-label` and `data-detent-labels` hooks are now `data-slider-stop-label` and `data-slider-stop-labels`.
