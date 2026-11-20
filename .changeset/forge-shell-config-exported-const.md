---
'@weasel-js/forge': patch
---

forge reads a shell config's `title` and `capture.allowOrigins` through an exported `const`. That covers `export const config = defineShellConfig({ … }); export default config;`.

<!-- entry: fix -->
