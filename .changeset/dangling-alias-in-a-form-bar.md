---
'@weasel-js/ui': patch
---

An alias that points at nothing in an `as: 'bar'` group of a `PrefsForm` draws `(alias: no pref at …)` in a cell when the bar runs across, as a `Bar` and a form's row already did. It used to draw no cell, so the wiring fault did not show.
