---
"@weasel-js/labkit": patch
---

An instrument named `__proto__`, `constructor`, `toString`, or another key every object inherits keeps its own config defaults, migration, schema, and serializers. One named `__proto__` lost them all, so its trials failed to load; one named `toString` or `constructor` without a migration of its own ran the object prototype's function as one, which dropped the stored config.
