---
'@weasel-js/labkit': patch
---

`Split` gives way in a strip too narrow for both panes' floors: it lays the sidebar out below `minWidth` first, down to nothing, and only then the content below `contentMinWidth`, so a trial tile under 300px no longer runs its content pane out past the tile. The sidebar's stored width is untouched and comes back when the strip widens; `minWidth` still bounds a drag.
