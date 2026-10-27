---
'@weasel-js/core': patch
---

`<SceneCanvas>` mounts a text editor of its own, so a node the text or sticky tool places can be typed into with no host wiring, and with the `edit` feature a double-click on a text node edits it. The new `textEditor` prop takes `useSceneTextEdit`'s options, or `false` for none. The editor mounts its overlay in the canvas's offset parent, and stands down for a host's own: a `useSceneTextEdit` whose container holds the canvas, or a `textEdit` dep a child registers. `drawOneEditing` takes the `drawOne` to wrap, and `useSceneTextEdit`'s `onDoubleClick` takes a DOM `MouseEvent` as well as React's.
