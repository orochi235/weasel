---
'@weasel-js/text': patch
---

Keep a line that fits its box on one line when the wrap's width for it differs from the line's own in the last bits, so a text sized with `fitTextPose({ axis: 'both' })` no longer wraps its last word.
