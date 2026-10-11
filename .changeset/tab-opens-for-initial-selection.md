---
'@weasel-js/ui': patch
---

`PrefsForm` showed the first tab of a tab strip that drew for the first time with `selected` naming a row in a later tab, leaving the selected row out of the page. The strip now opens on the tab that holds the selection.
