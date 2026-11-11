---
"@weasel-js/geom": patch
"@weasel-js/core": patch
"@weasel-js/path-tools": patch
---

Repeat Along lays its copies end to end along the path, so a saved document's repeats land in new places.

Each copy is as long along the path as the shape is wide. A count with no spacing puts the first copy's start at the path's start and the last copy's end at its end, rather than centering them on the ends, and `spacing` is the gap between one copy's end and the next one's start, not between their centers. On an open path a copy that `offset` slides partly off an end is kept; one slid wholly off is dropped. `stationsAlongPath` takes the copies' length as a third argument, 0 by default.

<!-- entry: rank=10 behavior data visual api -->
