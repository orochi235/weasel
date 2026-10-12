---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

Every overlay takes its `z-index` from the theme's layer ladder. Adds tokens: `--wzl-z-hud` (900), `--wzl-z-toast` (1100), `--wzl-z-popover` (1200), and `--wzl-z-drag` (10000). `Dialog`, `Toast`, `Tooltip`, `Callout`, core's debug HUDs, and labkit's drag ghost read a rung where each held a literal of the same value, and core's rungs carry that value as a fallback for a page with no theme.

Breaking: `--wzl-z-modal` is 1000, where it was 30 and below every dialog. labkit's lightbox, its one reader, rises with it. `DragGhost` in `@weasel-js/ui` moves from `--wzl-z-overlay` (20) to `--wzl-z-drag`, so a row dragged out of a list inside a `Dialog` draws over the dialog; the ghost `useDragHandle` clones reads the same rung.
