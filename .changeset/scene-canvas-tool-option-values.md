---
'@weasel-js/core': minor
---

`<SceneCanvas toolOptionValues>` takes the store where a host keeps its tools' option values, which an options row reads and writes.

```tsx
const [values] = useState(createToolOptionValues);
<ActiveToolOptionsBar tools={tools} values={values} />
<SceneCanvas tools={registry} toolOptionValues={values} />
```

Unset, the canvas uses a store published beneath it, else one it holds in memory, as before. A child still publishing with `useToolOptionValues` overrides the prop.

<!-- entry: api -->
