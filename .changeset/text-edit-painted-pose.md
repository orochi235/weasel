---
'@weasel-js/core': patch
---

`useSceneTextEdit` edits text where it is drawn. The overlay and the double-click test both read the pose a node is painted at, so text inside a container whose pose is a frame (`RIGID_POSE_COMPOSITION`) opens over the turned or skewed text and takes a click there; it used to open where the text would sit without the container. Under a view whose `scale.x` and `scale.y` differ, the overlay is stretched to match the canvas, where it used to scale both axes by `scale.x`.
