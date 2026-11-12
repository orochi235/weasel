---
"@weasel-js/text-dom": patch
---

A text edit opening also waits out `fontHold` for the bold and italic faces its runs use in the node's own family, not only the node's face.

<!-- entry: rank=-5 fix -->
