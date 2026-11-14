---
'@weasel-js/ui': major
---

`Slider`, `Jog`, the schema bar (now `PrefsBar`), `SwatchGrid` and `SwatchStrip` no longer take a `shape` prop; an `<Along>` around one curves it.

`Jog` and `PrefsBar` drop `align` too, which the `Along` now gives; `SwatchGrid` and `SwatchStrip` keep `align` for a grid's last row only. Each control's curved root fills the `Along`'s box, so a shape keeps its coordinates when it moves to the `Along`.

```tsx
// before
<Slider shape={arc} thumbs={thumbs} onInput={setThumbs} />
// after
<Along shape={arc}>
  <Slider thumbs={thumbs} onInput={setThumbs} />
</Along>
```

<!-- entry: rank=5 breaking api -->
