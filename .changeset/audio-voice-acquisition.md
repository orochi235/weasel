---
'@weasel-js/audio': major
---

`Acquisition` is `VoiceAcquisition`, the result of `VoicePool.acquire`, named beside `VoicePool` and `VoiceRecord`.

```ts
// before
const got: Acquisition = pool.acquire(record);
// after
const got: VoiceAcquisition = pool.acquire(record);
```

<!-- entry: breaking api -->
