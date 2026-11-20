---
'@weasel-js/prefs': minor
'@weasel-js/prefs-editor': patch
---

The condition editor names a test read from its group (`from: 'group'`) for the group's pref, and offers the group's prefs to read that way.

`conditionLeaves` takes the group's value path as a fourth argument, and `prefConditionFlow` as a `group` option, to name such a test the same way.

<!-- entry: fix api -->
