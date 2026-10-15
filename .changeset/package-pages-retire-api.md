---
'@weasel-js/animator': patch
'@weasel-js/core': patch
'@weasel-js/d3': patch
'@weasel-js/diagram': patch
'@weasel-js/font': patch
'@weasel-js/geom': patch
'@weasel-js/guides': patch
'@weasel-js/history': patch
'@weasel-js/hud': patch
'@weasel-js/kernel3d': patch
'@weasel-js/labkit': patch
'@weasel-js/minimap': patch
'@weasel-js/modes': patch
'@weasel-js/paint': patch
'@weasel-js/parallax': patch
'@weasel-js/prefs': patch
'@weasel-js/quantity': patch
'@weasel-js/react': patch
'@weasel-js/registry': patch
'@weasel-js/renderer': patch
'@weasel-js/routing': patch
'@weasel-js/select': patch
'@weasel-js/simulation': patch
'@weasel-js/stroke': patch
'@weasel-js/svg': patch
'@weasel-js/symmetry': patch
'@weasel-js/text': patch
'@weasel-js/text-dom': patch
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
