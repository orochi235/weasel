---
"@weasel-js/ui": patch
---

`ToolbarDock` lays toolbars out round a workspace. The host declares the docks, each on an edge (`{ id: 'strip', edge: 'top' }`), and the bars on offer, each naming the docks it may sit in and drawing itself for the orientation it is given; the workspace goes in as `children` and fills the middle. A dock holds rows of bars, a side dock draws its bars vertical, and an edge with no bars takes no room. A bar that draws nothing, such as one the host has hidden, takes no room either and keeps its place for when it comes back.

Where bars sit is a controlled `layout` value: the dock reconciles whatever it is given with the docks and bars there are now, and calls `onLayoutChange` with the layout a move settles on, for the host to store and hand back. With `movable`, each bar's lead turns into a handle named "Move {label} toolbar": drag it by its name to another slot, row or dock, or focus it and use Alt+arrows. A plain press on anything in the bar still clicks it.

A dock bar drawn as a `BarMenu` gets a handle too: a grip before its button, named and moved the same way.

A bar with `float: true` on its `DockBar` can also float over the whole dock, workspace and docks alike. Drag its handle more than 24 px off the row it sits in and it tears off, following the pointer from where it was held; let go over open space and it stays there, caught by a corner of the dock when dropped near one, the way labkit's `FloatingPanel` is. Drag a floating bar back over a dock row and the same drop marks show where it will land; while any bar is dragged, a dock it may enter that has no bars shows a strip along its edge to drop on. Alt+Enter on a handle floats a docked bar where it is, or docks a floating one at the end of its home dock, and the dock announces "File toolbar floating" or "File toolbar docked, row 1, position 3 of 3". Floating places are part of `layout`, under `floating`, and a floating bar keeps the orientation of the dock it left. A bar without `float` never tears off.

A `Bar` with `overflow="menu"` now asks for its natural length, its lead and every item, instead of taking all the
room its host has. In a row sized to its content it sits at that length, opens the menu only once the row squeezes it
shorter, and takes its items back as room returns. A `'menu'` bar in a block container, or stretched in a flex
column, used to fill the container's width; it now takes its natural length capped at the container, so a framed
bar's strip can end short of the container.
