---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

New: a sticky-note tool. `useStickyTool` is a built-in tool id, so `<SceneCanvas defaultTools={['sticky']}>` mounts it (key S), and `BUILTIN_TOOL_IDS` lists it after `text`. A drag draws a note through `insertAction`; a click places one of `size` through the new `placeAction` (id `place`), which commits a node of its binding's `kind` and `size` centered on the click through the same `insert` dep. Either drops into the new note's caret. The note's look (`background`, `fill`, `padding`, `style`, `verticalAlign`, `size`) is the tool's options and `toolOptions.sticky`; `STICKY_DEFAULTS` holds the rest. `stickyData` builds a note's data and `stickyNodeFactory` is the same as an `InsertNodeFactory`.

A note is a plain text node: `kit:text` nodes gain `data.background`, a fill painted over the whole box under the glyphs (and which makes the whole box pickable), and `data.padding`, the inset the text lays out in. `textBoxOf` is that box. `useSceneTextEdit` opens its overlay over the inset box, takes a double-click anywhere in the node's box, and returns `drawOne`, `defaultDrawOne` less the glyphs of the node being edited, for a canvas whose text nodes have a background that should stay painted while the overlay is up. The text properties gain Background and Padding. `svgLeafFromKit` writes a text node with a background as a group of its box and its inset text.

`ShapeKindDescriptor` gains `text`, which says a kind's node is text: an insert of it opens its caret, and its properties carry the text groups.
