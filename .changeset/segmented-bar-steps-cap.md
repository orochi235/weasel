---
'@weasel-js/ui': minor
---

A `SegmentedBar` drawn from `steps` takes a `cap`, and warns when a sweep that does not end is cut at the default 256 steps.

`<SegmentedBar steps={sweep} cap={32} … />` takes the first 32 steps without a warning, as `Sequence`'s `cap` does.

<!-- entry: api fix -->
