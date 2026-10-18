---
'@weasel-js/text': patch
---

`LaidOutLineBox` gains `justified`: whether `justify` spread that line's slack across its word gaps. It is false for a line that closes its paragraph, and for one with no gap or no slack.
