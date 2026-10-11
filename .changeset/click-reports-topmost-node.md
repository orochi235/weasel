---
'@weasel-js/core': patch
---

`<SceneCanvas>`'s `onClick`, `onDoubleClick`, hover chrome, and tool routing named the bottom-most node under the pointer where two overlapped, and a container rather than the child inside it, while the select tool selected the one on top. All of them now resolve the node the same way the select tool does. `isPointerInteractive` is asked about that node too, so a non-interactive node underneath an interactive one no longer makes the point dead.
