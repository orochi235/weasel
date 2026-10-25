---
"@weasel-js/labkit": patch
---

A lab whose config comes from a property schema (`f.prefs`) now honors a section's `showIf` and `enableIf`: each leaf in the section, nested sections included, is hidden or disabled with it. A leaf the section's `enableIf` reads stays live, so the section can be switched back on.
