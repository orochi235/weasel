---
"@weasel-js/text": patch
---

A text box fitted to its laid-out width no longer wraps a line under negative `letterSpacing`.

That covers `fitTextPose` with `axis: 'both'` and any box sized from `layoutRuns`' `bounds.width`, which now reports the farthest the line's ink reaches at any break opportunity.

<!-- entry: fix -->
