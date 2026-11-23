---
'@weasel-js/text-dom': patch
---

Closing a text edit that undo took back to how it opened writes nothing for text ending in a line break, as it already did for other text.

<!-- entry: fix -->
