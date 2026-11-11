---
"@weasel-js/forge": patch
---

The CSS variable panel's save reads only axis values, scales, seeds, and branches a theme holds as its own. A global naming a member of every object (`mode: 'hasOwnProperty'`) was taken as the axis value the trial renders under, where the theme engine falls back to the axis default, and a scale or seed named like one was read off `Object.prototype` and refused with the wrong reason.
