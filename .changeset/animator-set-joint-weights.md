---
'@weasel-js/animator': major
---

`setWeights` is `setJointWeights`: it sets one joint's weights on a skin.

```ts
// before
const next = setWeights(skin, count, 'arm', hits);
// after
const next = setJointWeights(skin, count, 'arm', hits);
```

<!-- entry: breaking api -->
