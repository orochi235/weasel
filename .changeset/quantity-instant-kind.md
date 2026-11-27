---
'@weasel-js/quantity': minor
---

An `instant` display kind writes a point in time as a date and time, such as `Nov 26, 2026, 2:32 PM`, `14:32` or `2026-11-26 14:32`.

A time is an offset from an origin, so its value lives in `duration`'s value space: seconds from `origin` (default the Unix epoch), or the time unit it is tagged with, so `tag(Date.now(), instant(), 'ms')` works. An instant plus a duration is plain arithmetic. `fields` takes `Intl.DateTimeFormat` options, `iso` writes ISO 8601 to the `'date'`, `'minute'` or `'second'`, and `timeZone` defaults to the viewer's. Typed text reads back through `Date.parse`.

<!-- entry: rank=5 new api -->
