---
'@weasel-js/geom': major
---

`runStationAt` is renamed `runPlaceAt`, since it returns a `TrackPlace`, like its neighbor `runPlaces`.

```ts
// before
const place = runStationAt(run, distance);
// after
const place = runPlaceAt(run, distance);
```

<!-- entry: breaking api -->
