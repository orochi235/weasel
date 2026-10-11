---
'@weasel-js/core': patch
---

`@weasel-js/core`'s `sideEffects` list now names its stylesheet. A bundler that honors the field was free to drop a bare `import '@weasel-js/core/style.css'`.
