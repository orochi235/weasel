---
'@weasel-js/core': patch
---

The default node properties show a typed number to at most two decimal places: position, size, font size, tracking, leading, and tab size. A node left at `123.45678901234567` by a drag read that way in the panel. Only the text changes; the stored value keeps its digits until someone types a new one.
