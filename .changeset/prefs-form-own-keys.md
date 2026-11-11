---
"@weasel-js/ui": patch
---

The prefs form's filter, rail pages and the schema editor's unplaced list keep a setting keyed `__proto__`. A path naming an inherited key such as `constructor` finds nothing.

<!-- entry: rank=-5 fix -->
