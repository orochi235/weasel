---
'@weasel-js/ui': patch
---

The schema editor's structure tree holds a row under an `actions` pref for each action of its registry group, in the order the bar draws them, so a toolbar's tree shows what it draws. Those rows take no selection or edit: the pref holds none of them. An `actions` row folds like a group, and its fold is kept the same way.
