---
'@weasel-js/d3': major
---

A binding's per-datum node data is set with `.payload(fn)`, which no longer reads as d3's `.data()` join.

`D3Binding.data` is renamed `payload`; the function it takes is unchanged.

```ts
// before
d3Bind(scene, points, { key }).pose(poseOf).data((d) => ({ label: d.name })).join();
// after
d3Bind(scene, points, { key }).pose(poseOf).payload((d) => ({ label: d.name })).join();
```

<!-- entry: breaking api -->
