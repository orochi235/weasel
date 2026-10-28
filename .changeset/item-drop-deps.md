---
'@weasel-js/diagram': patch
---

`createItemDropAction` and `itemDropContribution` take `requires`, the deps their `report` reads beyond the scene, and `report` gets the canvas's deps as its second argument, so a host on a `SceneCanvas` of its own can add the dropped item through `insert` and snap it through `snap`. This adds API.
