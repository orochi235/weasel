---
'@weasel-js/text-dom': patch
---

A text edit moved to another container waits for the fonts of the text it carries, including fonts applied during the edit, before it shows and measures the overlay.

<!-- entry: fix visual -->
