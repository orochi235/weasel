---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` keeps every size the reader can drag in its own settings: the widths of the structure, the attributes, the sidebar, and the live preview, and the heights of the Unplaced and Actions lists under the structure tree. They are hidden number prefs under `layout` in `PREF_SCHEMA_EDITOR_PREFS`, written once when a drag ends, so a host that passes a store as `prefs` gets them remembered with no further wiring. With no store they last as long as the editor is mounted, as before.
