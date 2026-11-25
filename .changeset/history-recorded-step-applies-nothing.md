---
'@weasel-js/history': patch
---

`observe` reports an empty `applied` for the step a `recordEntry` call or a journal's commit makes, since those ops ran before it. An observer replaying `applied` onto a mirror no longer applies a journal's session twice.

<!-- entry: fix -->
