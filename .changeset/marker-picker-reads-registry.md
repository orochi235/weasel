---
'@weasel-js/core': patch
---

The Start / Mid / End marker pickers in `defaultNodeProperties` and `inferredNodeProperties` now list markers a consumer registers with `registerMarker`. The options were read once at module load, before any consumer code could run; they are now read from the registry when the schema is used.
