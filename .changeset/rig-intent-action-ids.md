---
'@weasel-js/rig': major
---

The rig tools' action ids name what they do: `'bone.shape'` (was `'bone.drag'`) and `'weight.dab'` (was `'weight.click'`).

```ts
// before
{ spec: { kind: 'click' }, actionId: 'weight.click' }
// after
{ spec: { kind: 'click' }, actionId: 'weight.dab' }
```

<!-- entry: breaking api -->
