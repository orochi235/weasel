---
'@weasel-js/labkit': minor
---

A palette command or toolbar button can fire an action the trial's scene canvas registers, with `ctx.runAction(id, params)`.

```ts
const expand: TrialContribution = {
  id: 'expand-warp',
  region: 'palette',
  item: { icon, label: 'Expand warp', onActivate: (ctx) => { ctx.runAction('expandWarp'); } },
};
```

It returns whether the action ran. A hand-built `TrialChromeContext` needs a `runAction` of its own.

<!-- entry: api -->
