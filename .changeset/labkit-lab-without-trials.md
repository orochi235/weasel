---
'@weasel-js/labkit': minor
---

A `<Lab>` with no `instruments` runs with no trials, and its children are the page's body.

A history the body hands over with `useTrialHistory` gets the lab's Undo and Redo and their keys. `instruments` and `defaultInstrument` are optional; `defaultInstrument` defaults to the first instrument. With instruments, `children` still go to the header.

```tsx
<Lab title="Palette" pages={PAGES} path={PALETTE.href}>
  <Editor />
</Lab>
```

<!-- entry: rank=10 new api -->
