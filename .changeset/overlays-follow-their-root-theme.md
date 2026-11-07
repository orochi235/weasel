---
'@weasel-js/ui': patch
---

A `Popover` used on its own, outside any other weasel overlay, now portals into the nearest themed ancestor of where
it is rendered, so it draws in that root's theme instead of the page's. A `ToastRegion` given no container does the
same and still sits fixed in the viewport's corner. In a light app root on a page that resolves dark, both used to
draw dark. Tooltips, dialogs, and menus already behaved this way. `@weasel-js/ui/portal-host` gains `useOverlayTarget`,
the resolution `Popover` uses.
