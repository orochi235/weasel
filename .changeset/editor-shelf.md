---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` and `AssetEditor` show the Literal and the Changes as two tabs of one panel, in a shelf under the attributes and the preview that starts at 180px and drags taller or shorter from a handle on its top edge. The panel's Copy button copies the tab shown. The Settings and Actions lists move out from under the structure tree into the shelf, beside that panel.

Breaking for a host that kept the editor's prefs: `PREF_SCHEMA_EDITOR_PREFS` drops `layout.settingsHeight` and `layout.actionsHeight` and gains `layout.shelfHeight`. The Literal and Changes are no longer regions of those names: the panel is the region `Export`, holding a tab and a tab panel for each.
