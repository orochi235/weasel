---
'@weasel-js/ui': patch
---

The schema editor's shelf has a drag handle after its Settings list and after its Actions list. Each list stands at the width it was dragged to, kept in the editor's prefs as `layout.shelfSettingsWidth` and `layout.shelfActionsWidth`, and the export takes what they leave. They used to split the shelf one to one to two.
