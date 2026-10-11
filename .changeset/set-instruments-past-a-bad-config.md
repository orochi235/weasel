---
'@weasel-js/labkit': patch
---

`setInstruments` no longer rejects when an instrument's `migrateConfig` throws on one held trial's or snapshot's config: that one keeps its config as stored, with a console warning, and the rest are migrated. A `defaultConfig` that throws still rejects the call and changes nothing.
