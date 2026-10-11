---
'@weasel-js/ui': patch
---

`PrefsForm` with `subPages` draws a nested group set to `as: 'section'` on its parent's page, where it had a rail entry and a page of its own. Only a nested group that is a page, with `as` unset or `'page'`, gets an entry.

A rail entry whose page would draw nothing, so that choosing it opens the first entry under it, has its name in the muted gray, and an entry nested under another is set in the light weight of the font. `PrefRailItem` says the first with `passes`.
