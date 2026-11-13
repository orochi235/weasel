---
'@weasel-js/ui': major
---

`DetentSlider` reports each detent through `onInput` and the finished gesture through `onChange`, as `Slider` does.

```tsx
// before
<DetentSlider items={rates} value={rate} onChange={setRate} onCommit={record} />
// after
<DetentSlider items={rates} value={rate} onInput={setRate} onChange={record} />
```

<!-- entry: breaking api -->
