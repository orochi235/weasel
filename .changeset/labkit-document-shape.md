---
"@weasel-js/labkit": patch
---

A stored lab whose `layout` or undocked panels hold a list now opens with them empty, as it does when they hold anything else that is not an object. A stored lab whose version is `NaN`, negative, or a fraction is set aside as unreadable, where `NaN` skipped every migration and opened as current.
