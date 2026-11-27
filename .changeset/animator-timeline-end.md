---
'@weasel-js/animator': minor
'@weasel-js/ui': patch
---

`timelineEnd(timeline)` gives where a timeline ends, its `duration` or else its last track's end, the same answer the animator plays to; the `Timeline` ruler now draws nested timelines' runs from it.

An optional second argument, a `LengthReader`, reads a stated duration in place of the default, which refuses `NaN`:

```ts
timelineEnd(timeline, (d) => Math.max(0, d) || 0);
```

<!-- entry: api -->
