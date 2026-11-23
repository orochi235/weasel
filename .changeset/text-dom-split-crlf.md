---
'@weasel-js/text-dom': patch
---

The text editor's overlay breaks a line once at a CRLF whose CR and LF fall in differently styled runs, matching the canvas.

<!-- entry: fix visual -->
