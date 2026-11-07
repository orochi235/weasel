---
'@weasel-js/text': patch
---

A justified line that ends in a space and a tab no longer gives part of its slack to that space, which hangs past the edge: the slack goes to the gaps between its words, so the line reaches the edge. Likewise a space after a tab that opens a line is not a word gap.
