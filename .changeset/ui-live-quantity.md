---
'@weasel-js/ui': minor
---

`LiveQuantity` shows a value that keeps moving between updates, such as an elapsed time or a countdown, redrawing only when its text changes.

It also covers a byte count or how long ago something happened.

Pass a `reading` (`@weasel-js/clock`) and a `display`. It sleeps until `nextChangeFor` says the text will change, and does nothing while the page is hidden or it is out of view. Its figures sit at the end of a box that only widens, so a digit gained never moves what is beside it.

```tsx
<LiveQuantity reading={{ value: elapsedSeconds, at: performance.now(), rate: 1 / 1000 }} display={duration()} />
```

<!-- entry: rank=10 new api -->
