---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s attributes pane no longer lists a read-only `default` for a pref that holds no value: a label, a separator, an action, or an alias. It read `Default: undefined`.
