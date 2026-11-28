---
'@weasel-js/quantity': minor
---

Any display can color its value by the band the value falls in, with `withTones(display, tones)`.

`tones.stops` is a band list of `{ color, name? }`; set `over: [min, max]` to place the stops as fractions of a
range. `present()` reports `tone: { color, name?, index }`, the HTML's `<data>` gets `data-tone` (no inline
style), and the spoken text ends with the tone's name unless `speak: false`. Text and parsing are unchanged.
`toneAt(tones, value)`, `toneOf(q)` and `QuantityView.tone` answer the tone on its own.

```ts
present(0.93, withTones(percent(), rarityTones())).spoken // '93 percent, legendary'
```

<!-- entry: rank=10 new api -->
