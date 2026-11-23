---
'@weasel-js/renderer': patch
---

The renderer's one-time warnings no longer hold memory for the life of the page.

They keep nothing in production, and in development only the latest few hundred, so a warning keyed on document data, such as an unreadable mesh color, cannot grow without bound.

<!-- entry: fix -->
