---
'@weasel-js/labkit': patch
---

A stored lab opens when one of its trials or snapshots cannot be read. A trial whose instrument throws from `deserialize` or `migrateConfig` is left out with a console warning, and its record stays in storage, neither written over nor deleted; before, one such trial rejected `openLabStore` and the whole lab showed an error on every load. A trial another tab stores in a state this tab cannot read is dropped from this tab the same way.
