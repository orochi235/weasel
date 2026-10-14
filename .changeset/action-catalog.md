---
'@weasel-js/ui': patch
---

The schema editor's Actions list is a catalog: a schema of `action` prefs, the node a toolbar already holds. A row picked there shows its attributes in the Attributes pane, where its name, description, icon, button text, and control are edited and its action key, shortcut, and what the registry calls it are listed. An `action` pref picked in the structure lists the same registry rows. A pref dragged out of the list is a copy of the catalog's, so it lands with what was edited there.

`AssetEditor` keeps the catalog in a new kind of asset, `{ kind: 'actions' }`, which `actionCatalog(actions)` starts. Its rows are dragged to sort and group them, the pane's header adds a group and removes one, and an edit is a step of the workspace's history, drafted and submitted with the rest. The asset list leaves it out. With no such asset, and in `PrefSchemaEditor`, the list is the host's actions with nothing to sort them.

Breaking: actions are filed by their key's path and no longer by `group`. `edit.undo` sits under a group `edit` and its row reads `undo`; a group shows the part of the key its actions share, and a row the rest. `Asset` gains the `actions` member, `headingOf` takes a `ShownAsset`, and a host that reads `workspace.assets[0]` as a dialog should use one it knows is shown.
