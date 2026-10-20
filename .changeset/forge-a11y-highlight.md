---
'@weasel-js/forge': patch
---

The workshop's Accessibility panel outlines the elements a finding names while the pointer or keyboard focus is on
it: a whole rule outlines every element it failed, one selector outlines just that element. The frame protocol
gains an `a11y.highlight` message carrying the targets to outline; an empty list clears them. An isolated story
with the `fullscreen` layout now gets a frame as tall as the viewport, so a child at `height: 100%` fills it.
