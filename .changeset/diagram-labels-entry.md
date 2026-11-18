---
'@weasel-js/diagram': major
---

The label entry for `ambient` is `diagramLabels`, since it carries the label's selection and text editing as well as its drag.

`diagramLabelDrag` is renamed `diagramLabels`; its options are unchanged.

```ts
// before
const labels = diagramLabelDrag({ scene, selected });
// after
const labels = diagramLabels({ scene, selected });
```

<!-- entry: breaking api -->
