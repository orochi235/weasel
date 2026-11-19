---
'@weasel-js/ui': minor
---

`BandEditor` takes `bandLabel`, the name a band is announced and spoken by, ahead of its range.

Start it with the text `renderBand` shows, so a voice user can say what they see: a band showing "Icon" is then named "Icon, 1 over 64 to 1 over 24". Without it a band is still named `Band N`.

```tsx
<BandEditor
  value={bands}
  renderBand={(band) => band.data.name}
  bandLabel={(band) => band.data.name}
  {...rest}
/>
```

<!-- entry: api new -->
