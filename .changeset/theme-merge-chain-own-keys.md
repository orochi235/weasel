---
'@weasel-js/theme': patch
---

Baking a theme that extends another fills a by-axis pin from its parent by the pin's and the axis value's own names. An axis value named like an `Object.prototype` member (`constructor`, `toString`) was never filled from the parent, and a by-axis pin with such a name that the parent lacks was filled with a JavaScript function.
