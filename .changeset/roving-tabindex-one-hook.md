---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`useRovingTabIndex` now finds its items in the DOM and writes their `tabIndex` itself, so it serves a container of arbitrary children as well as a data-driven bar, and labkit's `Toolbar`, `PaletteRegion` and `ViewportRegion` use it in place of labkit's private copy. Attach `rootRef` and `onKeyDown` to the container; the items take neither. Options: `itemSelector` (default `'button, [role="button"]'`), `orientation` (`'horizontal'`, `'vertical'` or the default `'both'`; a one-axis bar leaves the cross-axis arrows to the page), `tabStopIndex`, `onNavigate`, `onActivate`. The tab stop now follows focus, so Shift+Tab leaves a bar instead of landing back on its stop, and a bar with `tabStopIndex` returns the stop there once focus leaves. `aria-disabled="true"` items are skipped like `disabled` ones, an arrow pressed in a non-item control inside the container (a slider, a field) is left to that control, and a roving container nested in another keeps its own items. Breaking: `items`, `itemClassName`, `tabIndexFor` and the per-item `onKeyDown(index)` are gone, and `RovingItem` is replaced by `RovingOrientation`.

`ToolButton` drops its `tabbable` and `onKeyDown` props: the toolbar's roving
hook sets `tabIndex` and handles the keys, and a `ToolButton` outside a
toolbar is now an ordinary focusable button instead of one left out of the tab
order by default.
