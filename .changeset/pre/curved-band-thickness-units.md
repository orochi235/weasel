---
"@weasel-js/ui": patch
---

A curved slider reads its `--rp-track-height` in any unit when judging how far off the band a drag has gone. A height in rem or a `calc()` used to be read as its leading number in px.
