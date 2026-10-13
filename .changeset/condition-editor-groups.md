---
'@weasel-js/ui': patch
---

`PrefConditionEditor` composes conditions. A group among the rows holds rows of its own under its own quantifier, to any depth, so an `all` inside an `any` is edited in place where it was a line of read-only text. The quantifier is all of, any of, none of, or not all of, which is how a `not` around a group is drawn. A row says is not set and is none of as comparisons, and a number's row takes a second bound to make a range, each comparison on its own line under the pref. Any other `not` of a test is drawn as none of that one row.

A row reads across in three columns, the pref, the comparison, and the value, which line up down a group; in a group too narrow for that the pref takes a line of its own. The pref's path is shown in the list it is picked from and not on the row.
