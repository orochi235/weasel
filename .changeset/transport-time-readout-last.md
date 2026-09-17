---
'@weasel-js/ui': patch
---

Move `<Transport>`'s time readout to the end of the strip

The playhead readout sat second, before the loop toggle and the rate slider, so
every frame's rewrite reflowed both of them and the controls visibly vibrated
during playback. It now comes last, with `margin-inline-start: auto` and
`text-align: end` so it grows leftward into the slack rather than pushing the
mode toggle that `<Timeline>` renders beside it. `tabular-nums` alone could not
fix this: it equalizes digit width, not digit count, so crossing 10s still
reflowed.

Also adds a `Live` Storybook story binding `<AnimatedTimeline>` to a running
handle — the existing Timeline stories render the transport with inert
defaults, so its buttons did nothing there.
