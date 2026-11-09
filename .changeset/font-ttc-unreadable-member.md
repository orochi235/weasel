---
"@weasel-js/font": patch
---

A font collection with one member whose table directory or `name` table runs past the end of the file still unpacks its other members, listing the unreadable one's name as `null`, where it threw a `RangeError` for every member.
