---
'@weasel-js/labkit': patch
---

`fracIntersects` is now `fracEncloses`.

It never intersected: it answers true only when `inner` lies wholly inside
`outer`, which is what an annotation marquee wants — brushing selection is a
different gesture. Two rects that merely overlap got `false` from a function
whose name promised the opposite, so a consumer reading the name got it
backwards.

Breaking: the old name is gone rather than aliased. `fracContains` is unchanged
and still takes a point.
