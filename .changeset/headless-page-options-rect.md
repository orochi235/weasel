---
'@weasel-js/headless': patch
---

`serveHeadlessPage({ scene })` takes options typed for `RectPose` scenes, and `@weasel-js/headless/page` exports their type, `PageSceneOptions`. A registry whose functions read `RectPose`s was refused by the type checker before, although the page draws only 2D scenes.

<!-- entry: fix -->
