---
'@weasel-js/ui': major
---

A fit scope measures only its own element, so a fitted `Bar` raises no ResizeObserver loop when another observer resizes its parent.

`useFitScope` no longer watches the element's parent, so the element's box has to take the shape of its room: fill it, or be clamped to it. While it holds labels the element carries `data-fit-room` and `--fit-natural`, its width at the full forms, for its CSS to keep a box sized to its content that wide within its room as the labels shorten. `Bar` and `SegmentedBar` do this already; a stepped `SegmentedBar` keeps the width of its full labels, its segments sharing it. An element of your own needs the same rule:

```css
.myStrip:where([data-fit-room]) {
  min-inline-size: min(var(--fit-natural, 0px), 100%);
  max-inline-size: 100%;
}
```

`data-fit-spent` now clears once the element grows wider than it was with the room that mark gave it, not once its parent does. A `KeyBank` has no box by default, so its `FitLabel`s step only once a class gives it one.

<!-- entry: rank=5 breaking fix visual -->
