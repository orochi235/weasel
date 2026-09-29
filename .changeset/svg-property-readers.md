---
"@weasel-js/svg": patch
---

Every presentation property the SVG parser reads now goes through one reader,
and `@supports` asks that same reader, so a declaration `@supports` calls
honored is exactly one the parser applies without a warning. No public API
changes. Values the parser used to misread quietly are now read correctly or
reported in `warnings`:

- `opacity`, `fill-opacity` and `stroke-opacity` accept percentages
  (`50%` was read as fully opaque).
- `stroke-width`, `stroke-dasharray` and a `<text>`'s `font-size` no longer
  take the number out of an unconverted unit silently: `stroke-width: 2em` is
  still read as 2 but warns, a dash list with such a unit is dropped with a
  warning, and `font-size: 150%` on `<text>` becomes 24 against the 16px
  default instead of 150, with a warning.
- `font-style: oblique` is read as italic on `<text>` as well as `<tspan>`,
  with a warning; `font-weight: lighter` on `<text>` is dropped instead of
  kept as a string.
- `text-decoration` reports a token it does not model (`wavy`, a color);
  `blink` is still dropped silently.
- `fill`/`stroke: context-fill | context-stroke` on a shape outside a marker paints
  nothing, as SVG says, instead of black with a warning.
- `color: currentColor` inherits, and `stop-color: currentColor`, still black,
  now warns.
