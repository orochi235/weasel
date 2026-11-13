---
'@weasel-js/labkit': major
---

`<Lab>` names the instruments it opens with `opening` alone: `defaultInstrument` is gone.

`opening` defaults to the first of `instruments`, so a lab opening its first instrument passes neither. A presented lab whose `seed` names no instrument opens the first of `opening`.

```tsx
// before
<Lab instruments={[grid, plot]} defaultInstrument="Plot" />
// after
<Lab instruments={[grid, plot]} opening={['Plot']} />
```

<!-- entry: rank=10 breaking -->
