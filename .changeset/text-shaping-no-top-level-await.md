---
'@weasel-js/text-shaping': patch
---

`@weasel-js/text-shaping` no longer pulls a top-level `await` into a consumer's bundle, so an app bundling for a target below ES2022 (esbuild, Vite) builds. harfbuzzjs's JavaScript is vendored into the package with its `init` exported, and `loadShaper` instantiates the WebAssembly itself: in Node from the `harfbuzzjs` package, elsewhere from a `harfbuzz.wasm` the package now ships beside its JavaScript.
