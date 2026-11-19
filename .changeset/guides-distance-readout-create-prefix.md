---
'@weasel-js/guides': major
---

`distanceReadout` is `createDistanceReadoutContribution`, spelled like the other contribution factories.

This is a breaking rename, with no alias. Its options, its default id `'distanceReadout'` and its action id are unchanged.

```ts
// before
const readout = distanceReadout({ modifier: 'alt' });
// after
const readout = createDistanceReadoutContribution({ modifier: 'alt' });
```

<!-- entry: breaking api -->
