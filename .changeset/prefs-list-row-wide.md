---
'@weasel-js/ui': patch
---

`PrefsForm` with `rowsAcross={2}` gives a leaf whose default is a list the full width of the pane, as it does an object leaf. In half a pane a `ListEditor` had too little room to show its entries.
