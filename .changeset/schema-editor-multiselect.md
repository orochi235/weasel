---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`PrefSchemaEditor` selects several nodes at once. In the structure tree, Cmd or Ctrl on a click adds a row or takes it out and Shift takes a range; in the live preview, Cmd or Ctrl on a press does the same. The selected nodes drag, copy, and delete together as one step back, and a press on one of them in the preview that ends without a drag selects that one alone.

With several selected, the attributes pane is headed with how many, and shows the attributes every one of them has. An attribute they agree on shows its value; one they differ on shows "Mixed" and takes an edit that is written to all of them. A list, map, object, or union attribute that differs is listed as "mixed" and not edited. The Key row, a key that follows its name, a list's Entry panel, and Add alias are for one node, and are not offered for several.

**`PrefsForm` and `PrefsDialog`: `selected` is now a list of dotted paths**, where it was one path. Every path in it is marked, and the last is the one scrolled to and whose rail page or tab opens. A caller that passed a string passes a list of one. `onSelect` is called with a second argument, `{ toggle }`, true when Cmd or Ctrl was held without Alt. A press on one of several selected rows is reported on its click, not on the way down.

`PrefsForm` takes `mixed`, a set of dotted paths whose leaves stand for several values that disagree: each draws its control with no value, and a custom renderer is told through `mixed` on its `PrefRenderContext`.

`Tree` puts each row's node id on it as `data-tree-id`.

labkit's `ControlPanel` hands a custom control the `fields` a `field` leaf may name, as it already did for its built-in ones.
