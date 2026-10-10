---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` takes `taken`: the host's word that what `onSubmit` last handed over is now in `original`. Once it is true the editor drops the submitted changes from its draft and its Changes pane, and keeps any edits made after the submission. What was submitted is kept beside the draft under `draftKey`, so this holds across a reload.
