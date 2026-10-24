---
"@weasel-js/ui": patch
---

`ToolbarDock` docks toolbars down the left and right edges. A left or right dock sets its rows side by side as columns and draws each bar vertical; a drag drops along a column by height and across columns by width, a new column opens to the left of the first or the right of the last, and Alt+Up and Alt+Down move a bar along its column while Alt+Left and Alt+Right move it to the next column, then the next dock. The announcement names the column: "Tools toolbar, column 1, position 2 of 3".

Only a bar with `vertical: true` on its `DockBar` may sit in a left or right dock. A layout that puts any other bar there sends it to its home dock, the first dock in its own list that it may enter; a drag over such a dock shows it unavailable and drops nothing, and Alt+arrows skip it. A bar floated off a left or right dock floats vertical, and takes the orientation of whichever dock it lands in next.
