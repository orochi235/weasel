---
"@weasel-js/editor": patch
---

`useAutosave` writes a save it flushed when the page went away once. Its timer still ran afterward and wrote the document, and reported to `onSaved`, a second time.
