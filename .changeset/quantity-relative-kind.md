---
'@weasel-js/quantity': minor
---

A `relative` display kind writes a time against now, such as `3 min. ago` or `in 2 hr.`, through `Intl.RelativeTimeFormat`.

Its value is the time's offset from now, in seconds or the tagged time unit, negative for the past. It counts in the largest unit whose count stays under its threshold (default 60 s, 60 min, 24 h, 7 d, 5 wk, 12 mo; override with `thresholds`), truncated. `smallest`, `style` and `numeric` are options. It answers `nextChange` exactly, so a live readout of it wakes once a minute under an hour, then once an hour.

<!-- entry: rank=5 new api -->
