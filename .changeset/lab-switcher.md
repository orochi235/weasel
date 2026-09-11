---
'@weasel-js/labkit': patch
---

`<LabSwitcher>` turns a lab's title into the way to reach the project's other
labs. A project grows a wall, a dashboard, an ingest page, a bench; a tab strip
beside the title is the layout that stops working first, and every consumer was
writing its own.

The menu holds real anchors, not a `<select>` and not buttons: these are
separate documents, so an `href` is what gets middle-click, cmd-click and the
back button for free. The open page stays in the list and is marked with
`aria-current` rather than filtered out, so entries do not shift position as you
move between pages. Given fewer than two pages it renders a plain heading — a
disclosure arrow promising a menu of the page you are already on is worse than
no control.

`<LabShell>` takes `pages` and `path` and wires the same control into its own
title; without `pages` its title is unchanged. `currentPage(path, pages)` is
exported for consumers that mark the open page somewhere else — it matches on
the end of the path, so a query string, a trailing slash or a leftover `.html`
cannot lose it.
