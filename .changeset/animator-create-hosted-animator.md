---
'@weasel-js/animator': major
---

`hostAnimator` is `createHostedAnimator`, spelled like the other factories.

```ts
// before
const hosted = hostAnimator({ now, requestFrame });
// after
const hosted = createHostedAnimator({ now, requestFrame });
```

<!-- entry: breaking api -->
