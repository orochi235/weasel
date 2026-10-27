---
'@weasel-js/core': patch
---

`measureAt`, `measureIds` and `currentMeasureId` read the measurement layer's own nodes (`scene.nodesOnLayer`) rather than walking every node in the scene, so a measure hover costs the number of measurements, not the size of the document. Their `scene` argument now needs `nodesOnLayer` in place of `renderOrderNodes`; every `Scene` has both.
