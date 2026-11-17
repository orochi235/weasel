---
'@weasel-js/diagram': major
---

The reorder helper that lays out drop slots along an axis is `slotsAlong`, which no longer suggests sequence diagrams.

`sequenceSlots` is renamed `slotsAlong`; its arguments are unchanged.

```ts
// before
const slots = sequenceSlots('x', items);
// after
const slots = slotsAlong('x', items);
```

<!-- entry: breaking api -->
