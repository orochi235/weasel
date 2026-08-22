---
'@weasel-js/labkit': patch
---

Zoom readout stays legible past 100x

`formatZoom` switched from a percentage to a multiplier above 2x but kept one
decimal place at every magnitude, so a trial zoomed to 1009.74 read
`1009.7x` — a tenth of a multiple is below anything a reader can act on, and
the digits crowd out the toolbar and status bar. Past 100x the decimal is
dropped and thousands are grouped, so the same view reads `1,010x`.

Note that the toolbar's `+` / `−` buttons still bypass the 0.1–32 clamp that
`usePanZoom` applies to wheel zoom (`TrialChrome` multiplies the current
zoom and calls `setZoom` directly), which is how a trial reaches four
digits at all. That inconsistency is unchanged here.
