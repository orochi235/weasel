---
'@weasel-js/ui': patch
---

New `PrefSchemaEditor`: edit a preference schema's structure and each leaf's attributes with a live `PrefsForm` preview, and export the result as a TypeScript literal plus a list of changes. Attributes holding code (`encoding`, `unit`, `fromScalar`) are shown read-only and exported as `KEEP_FROM_SOURCE`, so a pasted literal fails typecheck until they are restored. Custom kinds describe their attributes through `kinds`. `printSchema`, `diffSchemas` and `formatChanges` are exported for use outside the component.
