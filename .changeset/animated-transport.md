---
'@weasel-js/ui': minor
---

`<AnimatedTransport handle={timeline} />` puts play, pause, loop, rate and a scrub bar on a live timeline with no lanes beside it.

It reads the playhead from the handle each frame it moves and writes every control back to it, as `<AnimatedTimeline>`'s transport does; `scrub={false}` leaves out the scrub bar.

<!-- entry: api new -->
