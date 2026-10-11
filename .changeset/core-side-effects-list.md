---
'@weasel-js/core': patch
---

`@weasel-js/core`'s `sideEffects` list now names its stylesheet and the two modules that register at load. A bundler that honors the field was free to drop a bare `import '@weasel-js/core/style.css'`, and to drop `renderer/effects/composite` (which registers the program group effects composite with) or `canvas/NodeShape` (which registers the built-in shape painters) once nothing else was imported from them.
