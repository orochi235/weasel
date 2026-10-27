---
'@weasel-js/ui': patch
---

`Tree`, `ItemList` and `LayerList` now type ahead through `@weasel-js/headless`, the same typeahead menus use, and `@weasel-js/ui` depends on it. A repeated letter now cycles through the rows it starts ("a", "a" goes to the next row starting with "a", where it used to search for "aa"); different letters still build a prefix, and `tree.typeaheadMs` still sets how long one lasts.
