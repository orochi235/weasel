---
'@weasel-js/ui': patch
---

`AssetEditor` edits a workspace: dialogs, and the layouts that point into them, in one undo history and one draft. Set `list` and its far pane lists the assets under `Dialogs` and `Panels`, to pick the one the tree, the attributes form, and the live preview show. A setting re-keyed, moved, or removed in a dialog takes its pointers with it in the same step, the Changes pane lists every asset's changes, and `onSubmit` is handed each changed asset with its literal. A read-only asset is shown locked and takes no edit. `workspaceCodec` keeps a workspace's draft. `PrefSchemaEditor` is the same editor over one schema, and no longer draws an empty pane at its far edge.

`PrefsForm` and `PrefsDialog` take `over`, the schema their `alias` leaves point into, for a form drawn from a schema of aliases into another.
