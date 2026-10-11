---
'@weasel-js/ui': patch
---

`SelectionPanel` takes `selected` and `onSelect`, the props `PrefsForm` has. This adds API. `selected` is the paths of the rows to mark: a leaf's key in the schema (`data.fill`), or a field of an object leaf under its leaf's (`data.stroke.width`). When the last one changes the panel scrolls it into view and opens the tab that holds it. `onSelect(path, how)` reports a press or a focus into a row, with `how.toggle` true when Cmd or Ctrl was held. A row several leaves share through `pair`, and a section's heading, tab, or panel, are not marked and report nothing.

`PrefSchemaEditor` uses them for a section schema: its tree and its properties-panel preview now select each other, as they already did for a group schema.

The rule that draws the mark moved out of `PrefsForm`'s stylesheet into one both components load.
