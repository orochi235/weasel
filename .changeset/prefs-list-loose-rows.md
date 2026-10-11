---
'@weasel-js/ui': patch
---

`PrefsForm` in the `list` layout: the root's own rows take the inset of the subpanels under them, so a loose row's label and control share their edges with the rows inside a group. Before, a loose row ran the form's full width and its control ended 8px past the ones below it. A list with no groups is unchanged. `PrefSchemaEditor`'s attributes pane is where it shows: Name, Key, and Kind line up with the kind's panel under them.
