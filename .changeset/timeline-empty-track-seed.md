---
"@weasel-js/ui": minor
---

A key double-clicked onto an empty timeline track takes its target's value, and a track whose values the timeline cannot guess takes no key, with a warning, unless `seedKey` gives one.

`seedKey(track, t)` on `<Timeline>` returns the inserted key's value, or `undefined` to insert none. Without it, a track with no `interpolate`, `interpolator`, or `target` still seeds 0.

<!-- entry: fix api -->
