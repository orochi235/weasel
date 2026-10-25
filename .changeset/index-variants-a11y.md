---
'@weasel-js/forge': patch
---

An index page's variant rows pass axe's `heading-order` and `landmark-unique` checks. Each row is headed `h3` under its story's `h2`, where it was an `h4`, and its region is named for the story and the row (`Primary: Size`) rather than the row alone, which every story's rows shared.
