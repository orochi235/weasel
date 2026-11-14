---
'@weasel-js/ui': major
---

Each `FillStrokeSwatch` chip opens the whole paint editor, so a gradient or pattern slot is edited as itself, not flattened to a solid.

`onInput` and `onChange` report a `Paint` (or `null` for none) in place of a `#rrggbb` color, and `onChange` returns the paint actually applied when it differs, whose color the recent colors record. The editor carries the paint's own alpha, so a consumer no longer merges it back in. Shift-click on a chip still toggles none, and `portalContainer` places the editor's popover.

```tsx
// before
onChange={(slot, color) => setPaint(slot, { kind: 'solid', color })}
// after
onChange={(slot, paint) => setPaint(slot, paint)}
```

<!-- entry: rank=10 breaking api new -->
