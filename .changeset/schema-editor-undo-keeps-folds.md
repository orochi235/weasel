---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: undoing or redoing a group's re-keying or move leaves the group as open as it was. It came back folded, and with a `draftKey` was saved as folded.
