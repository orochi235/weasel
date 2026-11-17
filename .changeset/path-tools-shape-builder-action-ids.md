---
'@weasel-js/path-tools': major
---

The Shape Builder's action ids are `'shapeBuilder.showFace'` and `'shapeBuilder.takeFace'`, naming what they do.

They were `'shapeBuilder.hover'` and `'shapeBuilder.click'`. The tool's binding ids are unchanged.

```ts
// before
{ spec: { kind: 'click' }, actionId: 'shapeBuilder.click' }
// after
{ spec: { kind: 'click' }, actionId: 'shapeBuilder.takeFace' }
```

<!-- entry: breaking api -->
