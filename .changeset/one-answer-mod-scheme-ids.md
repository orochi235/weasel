---
'@weasel-js/routing': patch
'@weasel-js/ui-logic': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

**Behavior change:** `matchesKeyBinding` and `historyKey` now read `mod` the way `@weasel-js/gestures`
does: Command on an Apple platform, Ctrl elsewhere, and the other key forbidden. Before, either key
fired a `mod` binding on every platform, so Ctrl+Z undid on a Mac and Cmd+Z undid on Windows; now
neither does, and neither does Cmd+Ctrl+Z. Both take an optional `isMac` argument, defaulting to
`isApplePlatform()`. Everything built on them follows: labkit's trial chrome and `useUndoKeys`, and
the undo keys in `AssetEditor`, `LayeredCurveEditor` and forge's CSS-vars panel. A trial's snapshot
chord is Mod+S alone; Shift+Mod+S no longer takes a snapshot.

`rowKey` takes a sixth argument, `apple`, and selects all on Mod+A as above; Ctrl+A on a Mac no
longer selects all in a `Tree` or any list on `useRowNavigation`, which passes `isApplePlatform()`.
`rowKey` called without it reads `mod` as Ctrl.
