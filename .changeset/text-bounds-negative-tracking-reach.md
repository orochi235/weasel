---
"@weasel-js/text": patch
---

A text box fitted to its laid-out width (`fitTextPose` with `axis: 'both'`, or any box sized from `layoutRuns`' `bounds.width`) no longer wraps a line under negative `letterSpacing` when the line's last cluster is narrower than the tracking after it, such as a combining mark after a zero-width space. `bounds.width` now reports the farthest the line's ink reaches at any break opportunity, which is what the wrap measures.
