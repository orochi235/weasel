---
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

`<AnchorFields>` shows the anchors selected in path edit as numbers: their X and Y in document units, and for a lone anchor each handle's X and Y, or its angle and length, switched by the panel's Handles toggle (`handleCoords` and `onHandleCoordsChange` hold that choice outside, `defaultHandleCoords` seeds it inside). A field the anchors disagree on reads Mixed. Typing a number moves every selected anchor to it, and `accepts` reads units, so `1in` is 72 points given `{ pt: 1, in: 72 }`. It reads and writes through core's `useAnchorFields()`; pass `fields` to drive it from elsewhere. WeaselDraw shows it at the top of the Properties panel while anchors are selected.

`UnitField` and a typed `PropertyField` number take an offset: `+=` or `-=` and an amount, units read. Given `onOffset`, the amount goes there — what a mixed field needs, for each value it stands for to move by its own amount; without it, the offset is added to `value` and commits through `onChange`.

`<ActionBar only>` keeps just the named entries of its group, each an action id or an `id:variant` key.

`<SceneCanvas defaultPathEdit={{ id, anchors }}>` opens the canvas with that path in anchor edit and those anchors selected, as though it had been double-clicked; it is read once, at mount, and `id` must be selected. Its type is `PathEditOpening`.
