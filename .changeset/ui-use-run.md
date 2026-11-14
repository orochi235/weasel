---
'@weasel-js/ui': major
---

A control reads the row, column, or curve it sits in from one `useRun()`, which replaces `useTrackShape()`.

`useRun()` returns `{ orientation, shape, align, side }`: which way a straight run goes, the nearest `Along`'s track shape (undefined on a straight run), its alignment, and the side a popover opens on at the control's point of a curved bar. `<RunScope>` sets any of those for what it holds, keeping the enclosing run's other fields, and `fresh` starts it over from `STRAIGHT_RUN`. `AlongCtx` is gone.

```tsx
// before
const along = useTrackShape();
const shape = along?.shape;
// after
const { shape, orientation } = useRun();
```

<!-- entry: rank=5 breaking api -->
