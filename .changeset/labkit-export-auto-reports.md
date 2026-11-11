---
'@weasel-js/labkit': patch
---

Export the `AutoReports` type from the package root and `@weasel-js/labkit/config`. The chrome's and
control panel's public types already named it, so a consumer's declaration emit could not refer to it
(TS2742).
