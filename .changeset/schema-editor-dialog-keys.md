---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: Delete, Backspace, and Mod+Z pressed in one of the editor's own dialogs or popovers no longer act on the schema behind it. Backspace on the Add pref dialog's Kind picker removed the selected pref, and Mod+Z in its Name field undid a schema step.
