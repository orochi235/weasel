---
'@weasel-js/prefs': patch
---

The schema editor's drafts and sent copies are read and written through `@weasel-js/storage`'s `readLocal` and `writeLocal`, in `localStorage` or the `draftStorage` given.

Text under a draft's key that is not JSON reads as no draft, as before; a sent copy that is not JSON now reads back as its text rather than `null`.

<!-- entry: rank=-5 internal -->
