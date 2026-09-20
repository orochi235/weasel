---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Panel labels inherit their case, tracking, alignment and width.

`PropertyPanel`, `Prefs` and labkit's `ControlPanel` read four custom
properties — `--wzl-params-label-case`, `-tracking`, `-align` and `-width` —
so one declaration on any ancestor restyles every label beneath it. No rule
declares them; each label carries its default as a `var()` fallback, so an
override never has to outrank anything. `docs/conventions.md` ("Panel labels")
has the defaults and which labels each property reaches.

Visible changes at the defaults:

- An inline slider row's label sits on the leading edge. A rule meant to
  bottom-align a stacked row's track outranked the inline layout and packed the
  label against its slider.
- Every label is uppercase, including `Prefs` row labels, the `Prefs` subpanel
  heading and labkit pair-cell captions, which were sentence case.
- Tracking comes from the theme's tracking tokens: row labels move from
  `0.04em`–`0.06em` to `--wzl-tracking-wide`, `Prefs` group titles to
  `--wzl-tracking-wider`, matching `PropertyPanel`'s.
- A `Prefs` row label no longer grows to fill its row. The control stays on the
  trailing edge.
