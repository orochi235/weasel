---
'@weasel-js/labkit': patch
---

Annotation marks now behave on a moving picture. A wheel over a mark zooms the trial's camera, where it used to be swallowed by the mark's input box; a mark no longer leaves a copy of itself behind when its tile moves; and the stage and canvas stack listen for the wheel actively, so `preventDefault` keeps the page from scrolling under the zoom.
