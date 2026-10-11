---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: the exported literal now escapes a carriage return in a string, which printed raw and left the literal unparseable. The Changes list, and what `onSubmit` is handed, now include a reorder inside a group that was also moved or re-keyed.
