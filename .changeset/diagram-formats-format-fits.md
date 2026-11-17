---
'@weasel-js/diagram-formats': major
---

The two tests of what a format can write share one verb: `formatFits` for a whole document and `formatFitsKinds` for a set of page kinds.

`formatHolds` is renamed `formatFits` and `formatTakes` is renamed `formatFitsKinds`; their arguments are unchanged.

```ts
// before
can(formatTakes(format, scenePageKinds(scene)));
// after
can(formatFitsKinds(format, scenePageKinds(scene)));
```

<!-- entry: breaking api -->
