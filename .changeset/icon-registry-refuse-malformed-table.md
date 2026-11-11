---
"@weasel-js/icons": patch
---

The icon registry's `add` refuses a batch holding a table without a string namespace and owner and an object of icons with a `TypeError`, before registering any of it. Such a table (a variant module loaded at run time, say) had thrown midway, leaving the tables before it registered with no release and no notice.
