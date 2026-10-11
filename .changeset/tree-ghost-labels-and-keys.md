---
'@weasel-js/ui': patch
---

Three small `Tree` fixes. The drag ghost names every row it carries by its label: a selected row hidden inside a collapsed branch was listed by its raw id. A space typed while a type-ahead search is under way is part of the search, so typing `new f` reaches "New folder" where the space used to activate the focused row. ArrowLeft on a disabled branch that `expandedIds` holds open moves focus to its parent, where it used to do nothing.
