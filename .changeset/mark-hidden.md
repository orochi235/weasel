---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

Adds API: `PrefsForm`, `PrefsDialog`, and `SelectionPanel` take `markHidden`, which draws each node whose `showIf` fails where they otherwise leave it out. The node is dimmed and carries a `hidden` badge on its row or its heading, and it takes a press, a selection, and a drag as any other row does. A group, a page, or a headed section hidden whole carries one mark for everything in it. A node an `enableIf` disables is drawn disabled either way. It is for a surface that authors the schema it draws, and `PrefSchemaEditor`'s live preview now passes it, so a pref whose `showIf` fails at the schema's defaults can be picked and dragged in the preview again.

Behind it, `applyPrefConditions` takes `{ keepHidden: true }`, which drops nothing and names the path of everything hidden in a new `hidden` set, as `disabled` names what is disabled. Breaking: its third argument is now that options object, so `keepEmpty` moves from a positional boolean to `{ keepEmpty: true }`. A renderer's context gains `hidden` and `hiddenAt` beside `disabled` and `disabledAt`.
