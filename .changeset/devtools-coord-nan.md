---
'@weasel-js/devtools': patch
---

The Dispatch tab's coord records show a pointer or world point that is not finite as `NaN` or `Infinity`. Such a record used to throw while the table drew it, which emptied the panel.
