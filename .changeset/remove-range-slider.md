---
'@weasel-js/ui': major
---

`RangeSlider` is removed: put a `Slider` in a `<Field label output>` for its label-and-value header.

`Slider` is fully controlled, so a value held by `defaultValue` moves into state, and each value is a thumb:

```tsx
// before
<RangeSlider label="Opacity" defaultValue={75} minValue={0} maxValue={100} formatOutput={(v) => `${v}%`} />

// after
const [thumbs, setThumbs] = useState([{ value: 75 }]);
<Field label="Opacity" output={`${thumbs[0].value}%`}>
  <Slider aria-label="Opacity" min={0} max={100} step={1} thumbs={thumbs} onInput={setThumbs} />
</Field>
```

`Slider` has no vertical orientation; a vertical `RangeSlider` has no replacement yet.

<!-- entry: rank=10 breaking -->
