---
'@weasel-js/labkit': patch
---

`<Lab addTrial={false}>` leaves the header's "Add trial" control out, for a lab
that opens its trials some other way. The default is unchanged.
