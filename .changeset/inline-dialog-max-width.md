---
'@weasel-js/ui': patch
---

An inline `Dialog` is at most 900px wide, as a modal one already was, so `PrefSchemaEditor`'s live preview no longer stretches across a wide pane. `--wzl-dialog-max-width` sets the cap for both. The editor's properties-panel preview is capped at 420px.
