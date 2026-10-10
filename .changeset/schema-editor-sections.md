---
"@weasel-js/ui": patch
---

`PrefSchemaEditor` opens a node's property schema as well as a preferences schema. Pass a `PrefSection` as `schema` and `onChange` hands a `PrefSection` back. A leaf under a section takes a dotted id (`pose.x`), the Add button reads "Add section" wherever a section is what gets added, and the live preview is a `SelectionPanel` over one scratch node holding the schema's defaults. The new `propertyRenderers` prop passes that panel its renderers.

**Breaking change to `SchemaChange` paths.** `diffSchemas` and `formatChanges` now join a node's keys with `/`: a change at `view` > `gridDensity` is reported at `view/gridDensity`, where it was `view.gridDensity`. A key under a section may hold dots, so a dot could no longer separate keys.
