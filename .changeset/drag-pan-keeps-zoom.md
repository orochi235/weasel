---
'@weasel-js/core': patch
---

Zooming with the wheel while a `viewport.dragPan` drag was held was undone by the next pointer move, which rebuilt the view from the scale captured at the press. The pan now carries on from wherever another input left the camera.
