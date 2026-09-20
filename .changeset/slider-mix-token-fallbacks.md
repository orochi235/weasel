---
'@weasel-js/ui': patch
---

Give `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix` their manifest
defaults (18% and 70%) where `range.module.css` and `Slider.module.css` read
them. Inside a `color-mix()` an unset custom property invalidates the whole
`background`, so a consumer without `tokens.css` loaded got an unpainted thumb
— while `--wzl-slider-track-h` and `--wzl-slider-thumb-size` on those same
rules already degraded to a usable size.
