---
'@weasel-js/ui': patch
---

The open tab of a run of `as: 'tab'` groups in a `PrefsForm` no longer wears the selection mark with nothing selected. The tab carries `data-pref-path`, and react-aria puts `data-selected` on whichever tab is open, which is what the mark was keyed on. A selected tab the reader has left is now marked through `data-pref-picked`, and a selected fragment's rows are marked by the shared `selection.css` rule, which gives them the row mark's rounded corners.
