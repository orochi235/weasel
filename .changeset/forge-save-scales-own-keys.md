---
"@weasel-js/forge": patch
---

The CSS variable panel's save reads only the axis values, scales, seeds and branches a theme holds as its own. A global such as `mode: 'hasOwnProperty'` saves under the axis default, as the theme engine renders it, and a scale or seed named like an `Object.prototype` member is refused for the right reason.

<!-- entry: rank=-5 fix -->
