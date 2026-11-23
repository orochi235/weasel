---
"@weasel-js/ui": minor
---

A key double-clicked onto an empty timeline track takes its target's value, or with no way to guess one, `seedKey`'s.

A track with its own `interpolate` or `interpolator` and no target takes no key without `seedKey`, and warns.

`seedKey(track, t)` on `<Timeline>` returns the inserted key's value, or `undefined` to insert none. Without it, a track with no `interpolate`, `interpolator`, or `target` still seeds 0.

<!-- entry: fix api -->
