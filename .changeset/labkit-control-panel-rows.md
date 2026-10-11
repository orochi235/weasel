---
'@weasel-js/labkit': patch
---

Three `ControlPanel` row fixes. A leaf with no single control (an action, list, map, union, or alias) that a `pair` put beside a neighbor drew its caption over an empty cell; it now keeps a row of its own. Clicking an action row's label ran the action, because the row was a `<label>` around the button; only the button runs it now. And a row whose resolver reads a path that is already auto and reads it back no longer offers the auto toggle, where clicking it threw `auto resolver cycle` out of the panel's render.
