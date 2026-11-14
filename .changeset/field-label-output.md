---
'@weasel-js/ui': minor
---

`Field` takes a `label` and an `output`, giving any control a label-and-value header.

A `label` is drawn and names the field as a group; an `output` shows at the end of the label's line, or after the control in a `row`, in equal-width digits.

```tsx
<Field label="Opacity" output={`${v}%`}>
  <Slider aria-label="Opacity" min={0} max={100} thumbs={[{ value: v }]} onInput={([t]) => setV(t.value)} />
</Field>
```

<!-- entry: api new -->
