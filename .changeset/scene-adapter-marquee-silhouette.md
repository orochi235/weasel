---
"@weasel-js/core": patch
---

`sceneToAdapter(...).hitTestArea` gives the same answer as the marquee in `SceneCanvas`: shapes are tested by their drawn outline with rotation applied, not by their bounding box. It still returns containers.
