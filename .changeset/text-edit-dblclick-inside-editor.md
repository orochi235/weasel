---
'@weasel-js/core': patch
---

Double-clicking a word in the open text editor could move the edit to a different node and drop what had been typed: `useSceneTextEdit`'s `onDoubleClick` measured the click against the run it landed in and hit-tested that offset as a canvas point. A double-click inside the editor is now left to the browser's word selection.
