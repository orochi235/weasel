---
'@weasel-js/core': patch
'@weasel-js/theme': patch
'@weasel-js/routing': patch
'@weasel-js/diagram': patch
---

Readers of saved shapes take only a plain object where they expect a record, as registry's `isPlainObject` says.

That is scene snapshots and documents, DTCG color values, diagram theme files and compound menu values. A class instance, `Map` or `Date` in their place, which no JSON text can produce, is now refused as a wrong shape instead of read as a record.

<!-- entry: rank=-5 behavior -->
