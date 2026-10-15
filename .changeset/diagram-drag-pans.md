---
'@weasel-js/diagram': patch
---

`DiagramView` pans on a drag that starts on empty canvas, as its docs say. The select tool behind picking marquee-selected on that drag, and as the active tool's binding it outranked the view's drag-pan, so the view never moved. The diagram picks one node at a time, so it drops the marquee; a click on empty canvas still clears the pick.
