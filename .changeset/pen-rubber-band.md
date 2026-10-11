---
'@weasel-js/core': patch
---

`usePenTool`: the segment trailing from the last anchor to the pointer, and the close hint over the first anchor (with its `pointer` cursor), never appeared, because nothing recorded where the pointer was. The pen now follows the `pointer` dep while a path is in progress, so both show wherever a canvas publishes one, as `<SceneCanvas>` does.
