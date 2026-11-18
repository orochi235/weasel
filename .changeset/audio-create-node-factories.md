---
'@weasel-js/audio': major
---

Audio's graph node factories are spelled `create…Node`, like `createGainNode`.

`filterNode`, `delayNode`, `reverbNode`, `compressorNode` and `insertNode` are `createFilterNode`, `createDelayNode`, `createReverbNode`, `createCompressorNode` and `createInsertNode`.

Their arguments are unchanged.

```ts
// before
const delay = delayNode(ctx, { time: 250 });
// after
const delay = createDelayNode(ctx, { time: 250 });
```

<!-- entry: breaking api -->
