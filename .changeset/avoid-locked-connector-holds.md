---
'@weasel-js/diagram': minor
---

Avoid routing leaves a locked connector's route alone on every edit and drag, and routes the others around that route.

`AvoidEdge` takes `locked`, which `avoidSceneInput` sets for a locked connector; the router never reroutes or nudges one, and reroutes it on the next update once unlocked.

<!-- entry: fix api -->
