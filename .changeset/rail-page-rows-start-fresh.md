---
'@weasel-js/ui': patch
---

`PrefsForm`'s rail layout starts a page's rows fresh when the open page changes, so a row no longer shows state left by a row with the same key on the last page, such as a map's half-typed entry. `PrefsPane` takes a `pageKey` naming the page its rows belong to, defaulting to `path`.
