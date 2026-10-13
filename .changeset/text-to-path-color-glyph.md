---
'@weasel-js/text': patch
---

`textToPath` refuses text holding an emoji with a reason of its own, `'color-glyph'`, added to `TextOutlinesFailure`. It used to throw `'no-outlines'` with a message asking for outlines to be registered for a fallback face, which cannot help: an emoji is a picture in its own colors and has no outline. An emoji still waiting for its bake was left out of the path without an error, and is now refused the same way.
