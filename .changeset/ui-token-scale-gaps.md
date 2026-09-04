---
'@weasel-js/ui': patch
---

Move seven stray literals in `ItemList`, `Slider` and `Timeline` onto the token
scale, which unblocks `npm run lint -w @weasel-js/labkit` — its design-token
check has been failing on them, and that step runs in CI.

Radii of 2px, 3px and 4px all become `--wzl-radius-sm` (3px) and `font-size:
12px` becomes `--wzl-font-size-sm` (11px), matching how the same values were
mapped when the scale was introduced. The slider tick's radius was keyed to its
own width and is now `--wzl-radius-pill`; both forms clamp to half the tick's
width at any width, so it renders as before.
