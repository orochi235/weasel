---
'@weasel-js/path-tools': major
---

Path edit's drag that selects anchors in a box has the action id `areaSelectAnchors`, matching core's `areaSelect`.

Its default binding's id is `areaSelectAnchors.drag`.

```ts
// before
{ spec: { kind: 'drag', target: 'empty' }, actionId: 'marqueeAnchors' }
// after
{ spec: { kind: 'drag', target: 'empty' }, actionId: 'areaSelectAnchors' }
```

<!-- entry: breaking api -->
