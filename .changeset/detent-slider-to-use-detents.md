---
'@weasel-js/ui': major
---

`DetentSlider` is replaced by `useDetents()`, a hook whose result you spread onto a `Slider`.

It takes the same `items`, `value`, `onInput`, `onChange` and `formatLabel`; `labels`, `trackHeight`, `aria-label` and `className` become the `Slider`'s own `stopLabels`, `trackHeight`, `aria-label` and `className`. `DetentItem` and `DetentValue` now come from `@weasel-js/ui/components/Slider`, and `DetentSliderProps` names the props the hook returns.

```tsx
// before
<DetentSlider items={rates} value={rate} onInput={setRate} labels="ends" trackHeight={8} aria-label="Rate" />

// after
<Slider {...useDetents({ items: rates, value: rate, onInput: setRate })} stopLabels="ends" trackHeight={8} aria-label="Rate" />
```

`trackHeight` no longer defaults to 8; a `Slider`'s default track is 24px.

<!-- entry: rank=10 breaking api -->
