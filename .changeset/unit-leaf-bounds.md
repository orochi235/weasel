---
'@weasel-js/ui': patch
---

A number leaf that declares a display unit converts its bounds too.

`SelectionPanel` converted the value through `toDisplay` and passed `min`, `max`
and `step` straight through, so a leaf storing radians and showing degrees
clamped typed degrees against a radian range: 90 came back as 6.283 — 2π, the
max — and the field silently stored 0.11 rad.

Only declared bounds convert. An omitted one has no stored counterpart to put
through the conversion, and its fallback (0..100 for a slider's track, a step of
1) is a display-space number already. `min` and `max` are points, so they
convert the way the value does; `step` is a distance, so it converts as a span —
a unit with an offset maps zero somewhere else.
