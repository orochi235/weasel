---
'@weasel-js/registry': minor
---

`createPart(make)` returns a reader that gives each owner one part, made on its first read and held weakly with the owner.

```ts
export const transportHoldOf = createPart((clock: TrialClock) => createTransportHold(clock));
```

<!-- entry: api -->
