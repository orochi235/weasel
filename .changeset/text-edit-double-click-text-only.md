---
'@weasel-js/core': patch
---

`useSceneTextEdit`'s `onDoubleClick` opened an edit on whatever node was under the pointer, so double-clicking a rectangle mounted an empty editor over it and typing wrote `text` onto a node that is not text. It now opens only a text node, passing through anything else to the text beneath. New surface: an `isText(data)` option (default: `data.text` is a string, the test `inferredNodeRouting` uses) and a returned `isTextNode(id)` that asks it by id, which is the shape `TextEditDep.isTextNode` takes.
