---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: editing a value in the live preview of a node property schema no longer rewrites the default of every pref keyed outside `pose.` and `data.`. A pref keyed `lineWidth` lost its default on any preview edit, and one keyed `kind` or `id` took the scratch node's own value. Only the value that was edited becomes a default now.
