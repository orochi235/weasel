---
'@weasel-js/d3': major
---

`d3Bind`'s options type is `D3BindOptions`, so it no longer shares labkit's `BindOptions` name.

`BindOptions` is renamed `D3BindOptions`; its fields are unchanged.

```ts
// before
const options: BindOptions<Datum, RectPose> = { key: (d) => d.id, animator };
// after
const options: D3BindOptions<Datum, RectPose> = { key: (d) => d.id, animator };
```

<!-- entry: breaking api -->
