---
'@weasel-js/diagram': major
---

The label entry for `ambient` is `createDiagramLabelsContribution`, since it carries the label's selection and text editing as well as its drag.

`diagramLabelDrag` is renamed `createDiagramLabelsContribution`; its options are unchanged.

```ts
// before
const labels = diagramLabelDrag({ scene, selected });
// after
const labels = createDiagramLabelsContribution({ scene, selected });
```

<!-- entry: breaking api -->
