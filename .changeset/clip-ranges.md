---
'@weasel-js/animator': minor
---

A clip carries named `ranges`, and `rangeTimeline` plays or loops one by name.

```ts
const clip = bindClip({ version: 1, tracks, ranges: { intro: [0, 1200], idle: [1200, 2400] } }, binder);
animator.timeline(rangeTimeline(clip, 'idle', { loop: true }));
```

<!-- entry: new api -->
