---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Sit every run on a line on one baseline

Mixed-size text hung each run off the *line top* at its own ascent instead of
off a shared baseline, so a 16-unit run beside a 40-unit run floated up level
with the big run's cap rather than standing on the line with it. Two faces with
different ascents at the same size diverged the same way. Baseline alignment is
what inline text does everywhere else, and the module header already claimed
this behavior — the walk just never implemented it.

A line now sinks one baseline far enough to clear its tallest run's ascent and
places every glyph against it. Glyph quads derive their top from that baseline
rather than from the pen's line top, which is the whole of the change:
`qy0 = baselineY + (yoffset - metrics.base) * scale`.

Uniform-size text — nearly all text — is unchanged, since the maximum over one
value is that value. Only lines that actually mix sizes or faces move, and they
move to where they always should have been.

The test named "mixed-size runs share a baseline on the same line" asserted only
a quad count and passed throughout; it now asserts the baselines.
