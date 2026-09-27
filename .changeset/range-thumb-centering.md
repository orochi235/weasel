---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Range thumbs sit on the center of their tracks. `RangeSlider`'s thumb hung from the track's top edge, 2px above center inside labkit and 3px outside it; it now centers on both axes. The native range skin (`InlineRange`, `ColorField`'s alpha slider, `PropertyField` rows) centers its thumb with a transform instead of a margin, so a track and thumb whose sizes differ by an odd number of pixels no longer land half a pixel off in Chromium and WebKit. A disabled alpha slider now drops its thumb and fades its track in Chromium and WebKit too; those rules were being discarded there. labkit's skin for a bare `<input type="range">` is now extended from weasel-ui's skin instead of copied, so a bare range also gets the skin's focus ring, disabled state and full width.
