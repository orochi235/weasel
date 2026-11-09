---
'@weasel-js/ui': patch
'@weasel-js/ui-logic': patch
---

Fixes to page tab renaming, async combo box options, keyboard focus order, sweeps and tiled grids.

- Renaming a `PageTabs` tab and leaving its text as it was renames nothing. Before, confirming an unnamed page's field gave the page its numbered label ("Page 2") as a fixed name, which then stayed when the page moved.
- Enter or Escape in a `PageTabs` rename field hands focus back to the tab, where it used to drop to the page.
- `useAsyncOptions` reports a `load` that throws before returning a promise as a failed load (`loadError`), where `isLoading` stayed true for good.
- `domFocusScope`'s tab order keeps one radio per named group (the checked one, else the first) and leaves out what a closed `<details>` hides apart from its summary, as the browser's Tab does.
- ui-logic's `range` throws `RangeError` for a start that is not a finite number or an end that is NaN, and `frames` for a NaN or negative duration. Each used to walk NaN or endless steps, or yield a frame before 0.
- A tiled grid (`tileGrid`, `tileRows`, `tileKey`, `gridLayout`, and so a `SwatchGrid` or tiled bar) reads a column count below one, or NaN, as one, and a fractional one as its whole part. An arrow key in a `SwatchGrid` with `columns={0}` used to throw.
