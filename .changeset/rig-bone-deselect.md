---
'@weasel-js/rig': major
---

The bone tool's Escape action is `'bone.deselect'`, since it deselects the active joint; it was `'bone.clear'`.

```ts
// before
{ spec: { kind: 'key', key: 'Escape' }, actionId: 'bone.clear' }
// after
{ spec: { kind: 'key', key: 'Escape' }, actionId: 'bone.deselect' }
```

<!-- entry: breaking api -->
