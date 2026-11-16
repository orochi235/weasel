---
'@weasel-js/prefs': patch
---

The schema editor's drafts and sent copies go through `@weasel-js/storage`'s `readLocal` and `writeLocal`.

They are kept in `localStorage` or the `draftStorage` given, as before. Text under a draft's key that is not JSON still reads as no draft; a sent copy that is not JSON now reads back as its text rather than `null`.

<!-- entry: rank=-5 behavior -->
