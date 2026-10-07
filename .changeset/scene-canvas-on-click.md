---
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/diagram': patch
---

`<SceneCanvas onClick>` reports every click with the node under it, after the click's own behavior has run, including a click on a node that is already picked. `DiagramView` uses it, so `onSelect` fires on a re-click, and it now pans on a plain drag as well as the wheel. `diagramScene` throws on a repeated node id and drops a repeated edge with the same ends and label.
