---
'@weasel-js/ui': patch
---

`PrefsForm` and `PrefsDialog` take `selected`, the dotted path of a leaf or a group to mark, and `onSelect`, called when the reader presses or focuses into a row or a group. Each time `selected` changes the form scrolls to it, and a rail opens the group that holds it. `PrefSchemaEditor` uses both: selecting a node in the structure tree marks and shows it in the live preview, and pressing a row in the preview selects it in the tree. A properties-panel preview does not do this yet.

Each leaf's row now sits in a wrapping `div`.

`PrefSchemaEditor`'s tree lists a group root's own leaves under one branch named as the preview names it (`General` for a nameless root), ahead of the groups, and that branch is the root's row. The pane under the tree is titled "Unplaced".

`PrefsForm` takes `rowsAcross`: at 2, a rail pane sets its rows two side by side. `PrefSchemaEditor`'s preview uses it, its dialog drags wider or narrower from a handle on its edge (360px to 900px), and its enum options are headed "Value stored" and "Label shown".

`PrefsForm`'s rail is 176px wide by default, down from 216px, and `resizableRail` puts a drag handle between it and the pane. A modal `PrefsDialog` in rail layout settles at 800px, up from 760px. The editor's preview starts at 800px.
