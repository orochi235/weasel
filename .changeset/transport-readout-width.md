---
'@weasel-js/ui': patch
---

`Transport` no longer moves the controls beside it as its readouts change. The time readout is held at the width of the duration over itself, and the rate readout at the widest rate on offer, so a transport sized to its content (beside a `flex: 1` scrub bar, say) keeps one width as the playhead crosses 10s or the rate goes from `1x` to `0.25x`. The playhead is clamped to the duration for display. `data-testid="timeline-time"` moved to the visible text, so its `textContent` is still just the readout. The hidden sizer behind this is shared with `Select` and `ComboBox`'s `fit` width.
