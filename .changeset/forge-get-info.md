---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Add Get Info to weaselforge, and let the tool palette hold commands.

`ToolItem` takes an optional `onActivate`. An item carrying one is a command
rather than a mode: it presses instead of latching, never writes the tool slot,
and never reports itself as the current tool. Both contribution unions take the
context generic, with a default that leaves existing call sites alone.

forge contributes **Info** to that palette (⌘I). It opens a dialog holding a
fixed dossier for the focused trial's story: where it comes from — title,
export, id, library and file path — the JSDoc written above its export and
above its meta, and a row per arg with its kind, current value, default and
description. `indexFile` harvests the two comments and the meta's `component`
identifier from the AST it was already parsing, so the dossier reads correctly
for a story nobody has opened.

`useStoryRegistry` gains `isReady(id)`. An instrument exists with an empty
schema before its frame reports one, so without it a story that has not loaded
is indistinguishable from a story that takes no args.
