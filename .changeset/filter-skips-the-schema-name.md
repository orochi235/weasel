---
'@weasel-js/ui': patch
---

A `PrefsForm` filter that matched the schema's own name filtered nothing: typing `set` into a form named `Settings` kept every row. The filter now matches the groups and leaves inside the schema, not its title.
