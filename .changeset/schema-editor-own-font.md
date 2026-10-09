---
"@weasel-js/ui": patch
---

`PrefSchemaEditor` sets its own font and text color, so a page that mounts it outside a labkit root no longer shows it in the browser's default serif.
