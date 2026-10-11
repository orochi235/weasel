---
'@weasel-js/core': patch
---

`subscribeView` on the canvas ref handle now fires on a canvas controlled by its `view` prop. Subscribers were only told about `setView` writes, which a controlled canvas does not apply, so a zoom readout or DOM pinned to world coordinates showed the mount-time camera forever while `getView()` was right. They are now called when a committed `view` prop differs from the previous one.
