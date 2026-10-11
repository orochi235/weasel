---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

A clearable enum can no longer declare a default: `PrefEnum` with `clearable: true` requires `default: undefined`, so a missing value stays the only stored form of cleared. This is a type error for a schema that declared both; drop the default. The fields every enum leaf carries are exported as `PrefEnumBase`. `PrefSchemaEditor` drops an enum's default when it is made clearable and offers no Default field for one.
