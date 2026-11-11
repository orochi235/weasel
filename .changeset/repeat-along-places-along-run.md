---
"@weasel-js/geom": patch
"@weasel-js/core": patch
"@weasel-js/path-tools": patch
---

Repeat Along now lays its copies through `placeAlongRun`, and its placement changed, so a saved document's repeats land in different places. Each copy is an item as long along the path as the shape is wide: a count with no spacing spreads the copies so the first starts at the path's start and the last ends at its end (they used to be centered on the ends), and `spacing` is the space between one copy's end and the next one's start rather than the distance between their centers. On an open path a copy slid partly off an end by `offset` is kept, and only one slid wholly off is dropped. `stationsAlongPath` takes the copies' length as a third argument, 0 by default.

`runPlaces` and `placeAlongRun` judge an item against a run's ends within rounding error, as they already did round a wrapped closed run, so an item laid to meet an end exactly is no longer marked past it.
