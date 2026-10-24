---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
"@weasel-js/forge": patch
---

**Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
