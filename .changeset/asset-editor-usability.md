---
"@weasel-js/ui": patch
---

`Tree` takes `selectionFollowsFocus`: Up, Down, Home and End then select the row they reach, for a
tree whose selection drives something drawn beside it. Under `selectionMode="multiple"`, Shift with
those keys now extends the selection.

The asset editor and `PrefSchemaEditor` turn it on for the structure, unplaced and actions trees, so
walking a tree with the arrow keys walks the attributes with it. Removing a node selects the row
that takes its place, the next one where there is one, rather than its parent, so the selection
lands where keyboard focus does. Add pref's dialog calls the key "Key", as the attributes pane does.
The panes narrow toward their smallest sizes before the editor runs past the window's edge.

A `PrefsForm` with two rows across stacks them in one column once half its width is too narrow for
a row, where the rows' labels and fields used to run into each other. A `CodeBlock` can be focused,
so the keyboard can scroll it, and a select in a `DataGrid` cell is set at the cell's text size.
