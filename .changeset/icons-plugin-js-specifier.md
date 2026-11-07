---
'@weasel-js/icons-plugin': patch
---

`icon()` imported as `from './icons.gen.js'`, the way a TypeScript module written for Node's ESM resolution names its `.ts` neighbor, was left unrewritten with no warning: the plugin looked for `icons.gen.js` itself and never found the `.ts` source. Its glyphs could then be missing from a trimmed `virtual:weasel-icons`. A `.js`, `.mjs`, `.cjs`, or `.jsx` specifier now also finds its TypeScript source.
