---
'@weasel-js/ui': patch
---

`PrefsForm` in the columns and list layouts showed `No settings match “”.` and a `Clear filter` button for a schema with nothing to draw, such as an empty one or one whose leaves are all hidden. That message now appears only while a filter is typed, as it already did in the rail layout.
