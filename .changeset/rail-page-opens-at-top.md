---
'@weasel-js/ui': patch
---

A `PrefsForm` rail page opened by anything but a click on its rail entry kept the last page's scroll position: a controlled `section` changing, a selection opening its page, or a filter removing the open page. Every page now opens at its top.
