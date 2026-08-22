---
'@weasel-js/ui': patch
---

`Slider` gains `stops`: detents a drag catches on.

`stops?: number[]` are attractors, not quantization. A drag that comes within
8 track pixels of a stop lands on it; the arrow keys move stop to stop
(shift-arrow and Page jump ten), and a thumb added by clicking the track snaps
the same way. `step` is unchanged and still quantizes the values between
stops, so the two compose. Home and End keep going to the bounds, and per-thumb
`bounds` still clamps a snapped value.

Stops outside `[min, max]` are ignored rather than clamped inward — a stop that
cannot be reached is a mistake worth leaving visible in the value, not one to
paper over at an endpoint.
