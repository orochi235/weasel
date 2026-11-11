---
"@weasel-js/font": patch
---

A font collection with one unreadable member still unpacks the others, listing that member's name as `null`. A member is unreadable when its table directory or `name` table runs past the end of the file.

<!-- entry: rank=-5 fix -->
