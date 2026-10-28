---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` sets whether a leaf can be auto with one bar in the Auto panel's heading, Allowed, Starts auto, or Never, in place of the Never auto and Starts auto checkboxes, which could both be ticked at once. It writes `manual` and `unpinned` together. The Auto value row is now called Value.
