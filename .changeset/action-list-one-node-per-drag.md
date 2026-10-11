---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: dragging an action out of the Actions list no longer redraws the whole preview form on every pointer move. The list made a new pref for each move, so the preview never saw the same drop twice.
