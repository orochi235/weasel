---
"@weasel-js/ui": patch
---

`PrefsForm` (and so `PrefsDialog`) takes `subPages` in the rail layout. A nested
rail entry then opens a page of its own group instead of scrolling the open one
to it, and a top-level entry's page holds only its own leaves, or opens its
first nested entry when it has none. Off by default.
