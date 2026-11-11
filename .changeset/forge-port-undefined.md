---
"@weasel-js/forge": patch
---

A story arg holding an array with an `undefined` member, beside one the frame port cannot carry, reaches the story with that member still `undefined`, where it had become `null`. A control edit setting `null` under a key the port never carried, such as one holding a React element, is kept rather than replaced by the original value.
