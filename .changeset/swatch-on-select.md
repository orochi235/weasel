---
'@weasel-js/ui': major
---

`SwatchGrid`, `SwatchStrip` and `SwatchRings` report the swatch clicked through `onSelect` and `onAltSelect`.

They replace `onChange` and `onAltChange`; the callback types are `SwatchSelect` and `SwatchColorSelect`.

```tsx
// before
<SwatchStrip value={fill} onChange={setFill} onAltChange={setStroke} />
// after
<SwatchStrip value={fill} onSelect={setFill} onAltSelect={setStroke} />
```

<!-- entry: breaking api -->
