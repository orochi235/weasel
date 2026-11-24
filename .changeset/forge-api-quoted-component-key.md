---
'@weasel-js/forge': patch
---

The API panel and controls read the component a meta names under a quoted `'component'` key, or through a `<Meta>` assertion or a `!`, rather than falling back to the title's import.

<!-- entry: fix -->
