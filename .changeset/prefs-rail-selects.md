---
'@weasel-js/ui': patch
---

A press on a rail entry of a `PrefsForm` now reports that entry's group through `onSelect`, as a press on the group's heading in the pane does. The entry for the root's own leaves reports the empty path, which the editor takes as the root. A press used to open the page and report nothing, so in `PrefSchemaEditor` choosing a group in the live preview's rail left the structure tree and the attributes pane on whatever was selected before.
