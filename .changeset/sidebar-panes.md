---
'@weasel-js/labkit': patch
---

The lab's sidebar and aside lay their sections out as panes. Each section has its own box with a draggable seam between it and the next, its title bar stays put, and its body scrolls on its own; before, the whole pane scrolled as one. A folded section is as tall as its bar, the last open section takes the height the others leave, and a dragged height is kept with the lab (`lk-lab-sidebar-heights`, `lk-lab-aside-heights`). `SidebarPanes` is the component and is exported; `SidebarRegion` still lays a trial's sections out in one scrolling column.
