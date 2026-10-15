---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A leaf marked `heading` is drawn in the heading of the group holding it, in place of a row of its own. Additive: `PrefLeaf` gains `heading`, which labkit's `.heading()` already wrote and only `ControlPanel` read; `@weasel-js/prefs` exports `prefHeadingKey` and `prefFitsHeading`, which say which leaf a heading carries and whether a control fits there (a built-in `boolean` or `enum`). `PrefsForm` draws it in a page's, a section's, a panel's, and a column's heading, under the group's name, and `PrefSchemaEditor` lists the attribute as "In heading".

labkit's `sectionTree` marks the leaf a control panel would lift, so a form drawn from it shows the same control in the same heading, including a first row that only repeats its heading. Its warning for that row now says the row is drawn in the heading, as the panel's does.
