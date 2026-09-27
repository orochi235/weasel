---
"@weasel-js/labkit": patch
---

A `configSchema()` field whose `key` contains dots now draws in the control panel. The key is read and written as a config path everywhere else, but the panel filed the field as one child named `pose.x`, so the lookup by path found nothing and the row never drew. The field now sits under headless groups at the path its key names. Keep such an instrument's `defaultConfig()` nested to match: `{ pose: { x: 0 } }`, not `{ 'pose.x': 0 }`.
