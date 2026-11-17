---
'@weasel-js/diagram': minor
---

`markShape` and `registerMarkShape` take an `id`, so a mark painter with its own `geometry` can register beside `DiagramView`'s.

```ts
registerMarkShape({ id: 'chart:mark', geometry: CHART_POSE });
```

<!-- entry: api -->
