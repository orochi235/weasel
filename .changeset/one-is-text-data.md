---
'@weasel-js/core': patch
---

`isTextData` is the kit's one test for a text node, a string `text` on its data, and is exported. The default `textEdit` dep's `isTextNode` now asks it where it used to check `data.kind === 'text'`, so it agrees with `inferredNodeRouting` and `useSceneTextEdit`: a node carrying `text` and no `kind` is text to all three.
