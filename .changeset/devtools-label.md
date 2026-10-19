---
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

Add `<DevtoolsLabel value>`, which names the canvases beneath it in a devtools panel ahead of any
labeled element nearer to them. A labkit trial wraps its content in one with its title, so a plain
`<SceneCanvas>` in a trial, a forge story's included, is listed by the trial's title rather than as
"Content", the pane it sits in.
