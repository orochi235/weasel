---
'@weasel-js/ui': patch
---

A `ToolbarDock` drag no longer re-renders every bar on each pointer move: each bar's handle handlers and context are stable, and a bar is redrawn only when its `DockBar` object or orientation changes. A host whose bar content changes passes a new bar object, as one built in `useMemo` already does.

A second press during a `useFloatingPlacement` drag cancels the first drag, releasing its pointer capture, instead of leaving it running.
