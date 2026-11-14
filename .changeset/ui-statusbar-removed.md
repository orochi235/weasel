---
'@weasel-js/ui': major
---

`StatusBar`, `StatusBarItem`, and `StatusBarSpacer` are gone; a `Bar` with `framed="status"` draws the strip, with `Bar.Readout` and `Bar.Spacer`.

It is still a labeled `<footer>` and no live region; `divided` draws a divider between neighboring readouts, none beside a spacer.

```tsx
// before
<StatusBar aria-label="Editor status" divided>
  <StatusBarItem>zoom: 100%</StatusBarItem>
  <StatusBarSpacer />
  <StatusBarItem muted>0.7.0</StatusBarItem>
</StatusBar>
// after
<Bar framed="status" label="Editor status" divided>
  <Bar.Readout>zoom: 100%</Bar.Readout>
  <Bar.Spacer />
  <Bar.Readout muted>0.7.0</Bar.Readout>
</Bar>
```

<!-- entry: breaking api -->
