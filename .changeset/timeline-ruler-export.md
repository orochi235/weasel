---
'@weasel-js/ui': patch
---

Exports the timeline's time ruler: `Ruler` and `RulerProps`, and the window math it lays out with, `toFraction`, `toPercent`, `spanFraction` and `spanPercent`. A `Ruler` draws tick labels across a `TimeWindow` with a playhead line, scrubs on pointer drag, and pans or zooms its window on the wheel. Browser tests in ui, renderer and hud also pass on Linux Chromium now.
