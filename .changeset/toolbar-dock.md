---
"@weasel-js/ui": patch
---

`ToolbarDock` lays toolbars out round a workspace. The host declares the docks, each on an edge (`{ id: 'strip', edge: 'top' }`), and the bars on offer, each naming the docks it may sit in and drawing itself for the orientation it is given; the workspace goes in as `children` and fills the middle. A dock holds rows of bars, a side dock draws its bars vertical, and an edge with no bars takes no room. A bar that draws nothing, such as one the host has hidden, takes no room either and keeps its place for when it comes back.

Where bars sit is a controlled `layout` value: the dock reconciles whatever it is given with the docks and bars there are now, and calls `onLayoutChange` with the layout a move settles on, for the host to store and hand back. With `movable`, each bar's lead turns into a handle named "Move {label} toolbar": drag it by its name to another slot, row or dock, or focus it and use Alt+arrows. A plain press on anything in the bar still clicks it.

A dock bar drawn as a `BarMenu` gets a handle too: a grip before its button, named and moved the same way.

A `Bar` with `overflow="menu"` now asks for the length that holds every item rather than taking all the room its
host has. In a row sized to its content it gets that length, opens the menu only once the row squeezes it shorter,
and takes its items back as room returns. In a block container it still fills no more than the container's width.
