---
'@weasel-js/ui': major
---

`DetentSlider` is replaced by `useDetents()`, a hook whose result you spread onto a `Slider`.

It takes the same `items`, `value` and `formatLabel`. What `onChange` did, hearing every detent passed, is `onInput`, and what `onCommit` did, hearing the finished gesture, is `onChange`, as on `Slider`. `labels`, `trackHeight`, `ariaLabel`, `shape` and `className` become the `Slider`'s own `stopLabels`, `trackHeight`, `aria-label`, an `Along` around it, and `className`. `DetentItem` and `DetentValue` now come from `@weasel-js/ui/components/Slider`, and `DetentSliderProps` names the props the hook returns.

```tsx
// before
<DetentSlider items={rates} value={rate} onChange={setRate} onCommit={record} labels="ends" trackHeight={8} ariaLabel="Rate" />

// after
<Slider {...useDetents({ items: rates, value: rate, onInput: setRate, onChange: record })} stopLabels="ends" trackHeight={8} aria-label="Rate" />
```

`trackHeight` no longer defaults to 8; a `Slider`'s default track is 24px.

<!-- entry: rank=10 breaking api -->
