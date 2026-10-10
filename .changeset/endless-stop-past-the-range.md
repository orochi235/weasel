---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
"@weasel-js/prefs": patch
---

An endless slider end keeps its whole range. `endless` used to turn the end stop itself into infinity, so `min={0} max={5000} step={50} endless="max"` could reach 4,950 and then infinity, never 5,000. It now adds a stop for infinity one `step` beyond the range (a twentieth of the range where there is no step, and one more stop under `spacing: 'even'`, labeled with the display's word for infinity), so the track's own end is that stop and every value from `min` to `max` is still reachable. This reaches `Slider`, the slider `PropertyField` draws, `PrefsForm`, and labkit's `.endless()`.

A stored `Infinity` still reads as infinity. A value stored at the old top stop was stored as `Infinity`, so nothing stored changes meaning. A typed number past the range commits infinity, as before; one within half a step of the end commits the end.
