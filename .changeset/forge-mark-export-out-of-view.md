---
'@weasel-js/forge': patch
---

A mark export of a story that was never near the viewport now captures the story. Its host renders nothing while
out of view, so the export used to draw the marks over an empty background; the export now renders the story for
the capture, waits for it to paint, and lets it unmount again after.
