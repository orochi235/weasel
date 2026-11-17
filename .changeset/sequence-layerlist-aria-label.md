---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`Sequence`, labkit's `ClockFrames` and `LayerList` take their accessible name as `aria-label`, where they took `label`.

```tsx
// before
<Sequence label="Digits" sweep={digits}>{(n) => n}</Sequence>
// after
<Sequence aria-label="Digits" sweep={digits}>{(n) => n}</Sequence>
```

<!-- entry: breaking api -->
