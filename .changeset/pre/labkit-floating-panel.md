---
'@weasel-js/labkit': patch
---

Add `<FloatingPanel>` to `@weasel-js/labkit` — a draggable box that floats over
its offset parent and snaps to that parent's corners.

Drag it from anywhere that is not a control: `input`, `button`, `a`, `select`,
`textarea` and any `[data-no-drag]` element pass their pointer through, and a
drag that does start stops the event reaching a pan/zoom surface underneath.
`anchor` picks the resting corner, `snapCorners` limits which corners may
capture it, `inset` sets how far in it sits, and `storageKey` remembers where it
was left across reloads.

It drives windease's `floatingStrategy` — `layout()` and `reduce()` called as
pure functions — rather than mounting a windease container, because a lab
overlay has one item and no zone tree. This raises labkit's `windease` floor to
`^1.3.0`.

Parent it to the canvas stack's overlay: it positions against its offset parent,
so nesting it inside another absolutely-positioned overlay child measures that
child's box instead of the canvas.
